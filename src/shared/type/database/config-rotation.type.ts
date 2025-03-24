export type TDatabaseConfigRotation =
	| {
			intervalMs?: number;
			isEnabled: true;
	  }
	| {
			isEnabled?: false;
	  };
