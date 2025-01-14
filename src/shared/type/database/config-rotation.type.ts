export type IDatabaseConfigRotation =
	| {
			isEnabled?: false;
	  }
	| {
			isEnabled: true;
			intervalMs: number;
	  };
