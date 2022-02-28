/**
 * @module DateOnly
 */


/**
 * An interface to hold a date in an object
 */
export interface DateOnlyObject {
	/** the year */
	year: number;
	/** this month, 0 being January */
	month: number;
	/** the day of the month, 1-31 */
	date: number;
}

/**
 * A class representing a date with no timezone. Useful for
 * storing dates in databases as strings.
 * 
 * @param year The four digit year
 * @param month The month, 0-11 with 0 being January
 * @param date The day of the month, 1-31
 */
export class DateOnly {
	/**
	 * Create a DateOnly from a Date
	 * @param {Date} date A javascript Date
	 * @returns {DateOnly} A new DateOnly instance
	 */
	public static ofDate(date: Date) {
		let y: number = date.getUTCFullYear();
		let m: number = date.getUTCMonth();
		let d: number = date.getUTCDate();
		return new DateOnly(y, m, d);
	}

	/**
	 * Create a DateOnly instance from a string date. This
	 * method only does yyyy-mm-dd formatted strings.
	 * @param {string} dateStr in format YYYY-MM-DD
	 * @returns {DateOnly} A new DateOnly instance
	 */
	public static ofString(dateStr: string): DateOnly {
		let match = dateStr.match("^[0-9]{4}-[0-1][0-9]-[0-3][0-9]$");
		if (!match || match.length !== 1) {
			throw new Error(`date string ${dateStr} does not match 'YYYY-MM-DD'`);
		}
		//console.log(JSON.stringify(match));
		let parts = dateStr.split("-");
		return new DateOnly(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
	}

	/**
	 * Get today
	 * @returns {DateOnly} A date representing today
	 */
	public static now(): DateOnly {
		return DateOnly.ofDate(new Date(Date.now()));
	}
	/*
	 * Convert a javascript Date to a DateOnlyObject
	 * @param {Date} date A javascript date
	 * @returns {DateOnlyObject} an object with the year, month and date fields
	 *
	public static dateToObject(date:Date) : DateOnlyObject {
		let y : number = date.getUTCFullYear();
		let m : number = date.getUTCMonth();
		let d : number = date.getUTCDate();
		
		return {
			year: y,
			month: m,
			date: d
		}
	}
	*/

	private _y: number;
	private _m: number;
	private _d: number;

	constructor(year: number, month: number, date: number) {
		this._y = year;
		this._m = month;
		this._d = date;
	}

	private recreate() {
		let dod = DateOnly.ofDate(this.toDate());
		this._y = dod._y;
		this._m = dod._m;
		this._d = dod._d;
	}

	/**
	 * Year property get/set
	 * @type number
	 */
	public get year(): number {
		return this._y;
	}

	public set year(v: number) {
		this._y = v;
		this.recreate();
	}

	/**
	 * Month property get/set
	 * @type number
	 */
	public get month(): number {
		return this._m;
	}

	public set month(v) {
		this._m = v;
		this.recreate();
	}

	/**
	 * Day property get/set
	 * @type number
	 */
	public get day(): number {
		return this._d;
	}

	public set day(v: number) {
		this._d = v;
		this.recreate();
	}

	/**
	 * 
	 * @returns {Date} a javascript date representing midnight on this date
	 */
	public toDate(): Date {
		return new Date(this._y, this._m, this._d, 0, 0, 0, 0);
	}

	/**
	 * Returns a readable version of this date
	 * @returns {string} yyyy-mm-dd format
	 */
	public toString(): string {
		let y: string = this._y.toString();
		let m: string = String(this._m + 1).padStart(2, "0");
		let d: string = String(this._d).padStart(2, "0");
		return `${y}-${m}-${d}`;
	}

	public toJSON() {
		return this.toString();
	}

	/**
	 * Create an object format of this date.
	 * @returns {DateOnlyObject} this date in object format
	 */
	public toObject(): DateOnlyObject {
		return {
			year: this._y,
			month: this._m,
			date: this._d
		}
	}

}