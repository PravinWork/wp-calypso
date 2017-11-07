/** @format */

/**
 * Single Tree Rendering Codemod
 *
 * Transforms `ReactDom.render()` to `context.primary/secondary`.
 *
 * Transforms `renderWithReduxStore()` to `context.primary/secondary`.
 *
 * Adds `context` to params in middlewares when using `ReactDom.render()`.
 *
 * Adds `next` to params and `next()` to body in middlewares when using
 *   `ReactDom.render()` or `renderWithReduxStore()`.
 *
 * Adds `makeLayout` and `clientRender` to `page()` route definitions and
 *   accompanying import statement.
 */

const config = require( './config' );

export default function transformer( file, api ) {
	const j = api.jscodeshift;
	const root = j( file.source );

	/**
	 * Removes the extra newlines between two import statements
 	 * caused by `insertAfter()`:
	 * @link https://github.com/benjamn/recast/issues/371
	 */
	function removeExtraNewlines( str ) {
		return str.replace( /(import.*\n)\n+(import)/g, '$1$2' );
	}

	/**
	 * Ensure `context` is among parameters
	 */
	function ensureContextMiddleware( path ) {
		// `context` param is already in
		if ( path.value.params.indexOf( 'context' ) !== -1 ) {
			return path.value;
		}
		let ret = path.value;
		ret.params = [ j.identifier( 'context' ), ...ret.params ];

		return ret;
	}

	/**
	 * Adds `next` to params and `next()` to body
	 */
	function addNextMiddleware( path ) {
		if ( path.value.params.length > 1 ) {
			// More than just a context arg, possibly not a middleware
			return path.value;
		}
		let ret = path.value;
		ret.params = [ ...ret.params, j.identifier( 'next' ) ];
		ret.body = j.blockStatement( [
			...path.value.body.body,
			j.expressionStatement( j.callExpression( j.identifier( 'next' ), [] ) ),
		] );

		return ret;
	}

	function getTarget( arg ) {
		if ( arg.type === 'Literal' ) {
			return arg.value;
		}
		if ( arg.type === 'CallExpression' ) {
			// More checks?
			return arg.arguments[ 0 ].value;
		}
	}

	/**
	 * Input
	 * ```
	 * renderWithReduxStore(
	 * 	 <Example />,
	 * 	 'primary',
	 * 	 context.store
	 * );
	 * ```
	 *
	 * Output:
	 * ```
	 * context.primary = <Example />;
	 * ```
	 */
	function transformRenderWithReduxStore( path ) {
		const expressionCallee = {
			name: 'renderWithReduxStore',
		};

		return transformToContextLayout( path, expressionCallee );
	}

	/**
	 * Input
	 * ```
	 * ReactDom.render(
	 * 	 <Example />,
	 * 	 document.getElementById( 'primary' )
	 * );
	 * ```
	 *
	 * Output:
	 * ```
	 * context.primary = <Example />;
	 * ```
	 */
	function transformReactDomRender( path ) {
		const expressionCallee = {
			type: 'MemberExpression',
			object: {
				name: 'ReactDom',
			},
			property: {
				name: 'render',
			},
		};

		return transformToContextLayout( path, expressionCallee );
	}

	/**
	 * Input
	 * ```
	 * DefinedByExpressionCallee(
	 * 	 <Example />,
	 * 	 document.getElementById( 'primary' )
	 * );
	 * ```
	 *
	 * Output:
	 * ```
	 * context.primary = <Example />;
	 * ```
	 */
	function transformToContextLayout( path, expressionCallee ) {
		if ( path.value.params.length !== 2 ) {
			// More than just context and next args, possibly not a middleware
			return path.value;
		}
		return j( path )
			.find( j.CallExpression, {
				callee: expressionCallee,
			} )
			.replaceWith( p => {
				const contextArg = path.value.params[ 0 ];
				const target = getTarget( p.value.arguments[ 1 ] );
				return j.assignmentExpression(
					'=',
					j.memberExpression( contextArg, j.identifier( target ) ),
					p.value.arguments[ 0 ]
				);
			} );

		return j( node );
	}

	// Transform `ReactDom.render()` to `context.primary/secondary`
	root
		.find( j.CallExpression, {
			callee: {
				type: 'MemberExpression',
				object: {
					name: 'ReactDom',
				},
				property: {
					name: 'render',
				},
			},
		} )
		.closest( j.FunctionExpression )
		.replaceWith( ensureContextMiddleware )
		.replaceWith( addNextMiddleware )
		.forEach( transformReactDomRender );

	// Transform `renderWithReduxStore()` to `context.primary/secondary`
	root
		.find( j.CallExpression, {
			callee: {
				name: 'renderWithReduxStore',
			},
		} )
		.closestScope()
		.replaceWith( addNextMiddleware )
		.forEach( transformRenderWithReduxStore );

	// Remove `renderWithReduxStore` from `import { a, renderWithReduxStore, b } from 'lib/react-helpers'`
	root
		.find( j.ImportSpecifier, {
			local: {
				name: 'renderWithReduxStore',
			},
		} )
		.remove();

	// Remove empty `import 'lib/react-helpers'`
	root
		.find( j.ImportDeclaration, {
			source: {
				value: 'lib/react-helpers',
			},
		} )
		.filter( p => ! p.value.specifiers.length )
		.remove();

	// Add makeLayout and clientRender middlewares to route definitions
	const routeDefs = root
		.find( j.CallExpression, {
			callee: {
				name: 'page',
			},
		} )
		.filter( p => p.value.arguments.length > 1 && p.value.arguments[ 0 ].value !== '*' )
		.forEach( p => {
			p.value.arguments.push( j.identifier( 'makeLayout' ) );
			p.value.arguments.push( j.identifier( 'clientRender' ) );
		} );

	if ( routeDefs.size() ) {
		root
			.find( j.ImportDeclaration )
			.at( -1 )
			.insertAfter( "import { makeLayout, render as clientRender } from 'controller';" );
	}

	return removeExtraNewlines( root.toSource( config.recastOptions ) );
}
