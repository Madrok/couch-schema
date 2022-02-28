/**
 * @module Formatters
 * @requires google-libphonenumber
 */
// Require `PhoneNumberFormat`.
// import * as glp from 'google-libphonenumber';
import libphonenumber from 'google-libphonenumber';
const PNF = libphonenumber.PhoneNumberFormat;
const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

import debugModule from 'debug';
const debug = debugModule('couch-schema');

/**
 * A class full of formatters for all your data
 */
export class Formatters {
	/**
	 * Format a phone number for a region. The second parameter specifies what
	 * country the phone number is from. The third parameter can be one
	 * of the country codes from google-libphonenumber or the default string
	 * "INTERNATIONAL" which will use the enum value of the same name from the library.
	 * @param {string} v the phone number
	 * @param {string} countryCode the country code the phone number is in
	 * @param {string} formatFor the country to format the phone number to, defaults to INTL
	 * @see {@link https://github.com/ruimarinho/google-libphonenumber|google-libphonenumber}
	 * @see {@link https://github.com/ruimarinho/google-libphonenumber/blob/master/src/regioncodefortesting.js|List of country codes}
	 * @returns a formatted phone number
	 */
	static phone(v: string, countryCode: string = "US", formatFor:string="INTERNATIONAL"): string {
		console.log(`Formatters.phoneNumber ${countryCode} ${v}`);
		let number = phoneUtil.parseAndKeepRawInput(v, countryCode);

		if(formatFor === "INTERNATIONAL")
			return phoneUtil.format(number, PNF.INTERNATIONAL);
		return phoneUtil.formatOutOfCountryCallingNumber(number, formatFor);
	}
}
