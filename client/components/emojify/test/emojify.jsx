/**
 * @format
 * @jest-environment jsdom
 */

/**
 * External dependencies
 */
import { expect } from 'chai';
import { shallow, mount } from 'enzyme';
import React from 'react';

/**
 * Internal dependencies
 */
import Emojify from '..';

describe( 'Emojify', () => {
	describe( 'component rendering', () => {
		test( 'wraps a string in a div', () => {
			const wrapper = shallow( <Emojify>Foo</Emojify>, { disableLifecycleMethods: true } );
			expect( wrapper.find( 'div' ).getElement().ref ).to.equal( 'emojified' );
		} );

		test( 'wraps a block in a div', () => {
			const wrapper = shallow(
				<Emojify>
					<p>Bar</p>
				</Emojify>,
				{ disableLifecycleMethods: true }
			);
			expect( wrapper.find( 'div' ).getElement().ref ).to.equal( 'emojified' );
		} );

		test( 'replaces emoji in a string', () => {
			const wrapper = mount( <Emojify>🙂</Emojify> );

			expect( wrapper.html() ).to.equal(
				'<div class="emojify"><img draggable="false" class="emojify__emoji" alt="🙂" ' +
					'src="https://s0.wp.com/wp-content/mu-plugins/wpcom-smileys/twemoji/2/72x72/1f642.png"></div>'
			);
		} );

		test( 'replaces emoji in a block', () => {
			const wrapper = mount(
				<Emojify>
					<p>🧔🏻</p>
				</Emojify>
			);

			expect( wrapper.html() ).to.equal(
				'<div class="emojify"><p><img draggable="false" class="emojify__emoji" alt="🧔🏻" ' +
					'src="https://s0.wp.com/wp-content/mu-plugins/wpcom-smileys/twemoji/2/72x72/1f9d4-1f3fb.png"></p></div>'
			);
		} );

		test( 'maintains custom props', () => {
			const wrapper = shallow( <Emojify alt="bar">השנה היא 2017.</Emojify>, {
				disableLifecycleMethods: true,
			} );
			expect( wrapper.getElement().props.alt ).to.equal( 'bar' );
		} );
	} );
} );
