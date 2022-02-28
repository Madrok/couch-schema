/**
* This error is thrown when a document does not have the
* proper type field. 
*/
export class GeneratorError extends Error {
	constructor(...params: any) {
		super(...params);

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, GeneratorError)
		}
		this.name = "GeneratorError";
	}
}