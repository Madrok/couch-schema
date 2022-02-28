import nano from "nano";
import { AuthPermissions } from './AuthPermissions.js';
import { Auth } from './Auth.js';
import { Name } from './Name.js';
import { Person } from './Person.js';
import { Phone } from './Phone.js';

export function initializeModels(db: nano.DocumentScope<any>) {
	AuthPermissions.init(db, AuthPermissions);
	Auth.init(db, Auth);
	Name.init(db, Name);
	Person.init(db, Person);
	Phone.init(db, Phone);
}
