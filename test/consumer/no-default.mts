// @ts-expect-error -- The ESM runtime has named exports and no default export.
import connector from "@elsikora/nestjs-typeorm-aws-connector";

void connector;
