/**
 * @module Validators
 */
import libphonenumber from 'google-libphonenumber';
const PNF = libphonenumber.PhoneNumberFormat;
const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

import debugModule from 'debug';
const debug = debugModule('couch-schema');

/**
 * A collection of standward validators
 */
export class Validators {
	/**
	 * Validate an email address
	 * @param v {string} An email
	 * @returns {boolean} True if passed
	 */
	static email(v: string): boolean {
		return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(v);
	}

	/**
	 * 
	 * @param v {string} a north american phone number
	 * @returns 
	 */
	static phone(v: string, countryCode: string = "US"): boolean {
		if (/^[1-9][0-9]{2}-[1-9]{1}[0-9]{2}-[0-9]{4}$/.test(v))
			return true;
		let number = phoneUtil.parseAndKeepRawInput(v, countryCode);
		return phoneUtil.isPossibleNumber(number);
	}
}