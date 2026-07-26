import type { TMutableDriver } from "./mutable-driver.type";

export type TRetiringDriver = {
	driver: TMutableDriver;
	generation: number;
};
