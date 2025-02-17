import {
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
  Kind,
  locatedError,
} from 'graphql';

interface Validator {
  (rtn: string): boolean;
}

const routingNumber = (rtn: number | string) => '' + rtn;

const haveNineDigits: Validator = (rtn) => /^\d{9}$/.test(rtn);

/**
 * Calculates checksum for MIRC format XXXXYYYYC where C is the check digit
 *
 * The checksum is position-weighted sum of each of the digits. So, given the
 * routing number `031001175`, which The last digit (5 in the example), is the
 * check digit. The calculation is given in terms of the eight first digits:
 *
 * 0    3   1   0   0   1   1   7
 *                x
 * 3    7   1   3   7   1   3   7
 * ____________________________________
 * 0 + 21 + 1 + 0 + 0 + 1 + 3 + 49 = 75
 * ____________________________________
 * 75 + 5 (check digit) = 80 (Must multiple of 10)
 */
const checksum: Validator = (rtn) => {
  const weight = [3, 7, 1];
  const accumulator = (acc: number, curr: number): number => acc + curr;

  const digits = rtn.split('').map((digit) => Number.parseInt(digit, 10));
  const checkDigit = digits.pop();

  const sum = digits
    .map((digit, index) => digit * weight[index % 3])
    .reduce(accumulator, 0);

  return (sum + checkDigit) % 10 === 0;
};

const validate = (value: unknown) => {
  if (
    typeof value !== 'string' &&
    !(typeof value === 'number' && Number.isInteger(value))
  ) {
    throw locatedError(new TypeError('must be integer or string'), null);
  }

  const rtn = routingNumber(value);

  if (!haveNineDigits(rtn)) {
    throw new TypeError('must have nine digits');
  }

  if (!checksum(rtn)) {
    throw new TypeError("checksum doens't match");
  }

  return rtn;
};

export const GraphQLRoutingNumberConfig: GraphQLScalarTypeConfig<
  string,
  string
> = {
  name: 'RoutingNumber',
  description:
    'In the US, an ABA routing transit number (`ABA RTN`) is a nine-digit ' +
    'code to identify the financial institution.',

  specifiedByURL: 'https://en.wikipedia.org/wiki/ABA_routing_transit_number',

  serialize(value: unknown) {
    return validate(value);
  },

  parseValue(value: unknown) {
    return validate(value);
  },

  parseLiteral(ast) {
    if (ast.kind === Kind.INT || ast.kind === Kind.STRING) {
      return validate(ast.value);
    }

    throw locatedError(
      new TypeError(
        `ABA Routing Transit Number can only parse Integer or String but got '${ast.kind}'`,
      ),
      ast,
    );
  },
};

export const GraphQLRoutingNumber: GraphQLScalarType =
  /*#__PURE__*/ new GraphQLScalarType(GraphQLRoutingNumberConfig);
