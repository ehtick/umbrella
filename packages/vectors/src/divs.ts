// SPDX-License-Identifier: Apache-2.0
import { defOpSVV } from "./defopsvv.js";
import { $div } from "./ops.js";

const [a, b, c, d, e] = defOpSVV($div);

/**
 * Componentwise nD strided vector division.
 *
 * @param out - output vector
 * @param a - input vector
 * @param b - input vector
 * @param size - vector size
 * @param io - index (default: 0)
 * @param ia - index (default: 0)
 * @param ib - index (default: 0)
 * @param so - stride (default: 1)
 * @param sa - stride (default: 1)
 * @param sb - stride (default: 1)
 */
export const divS = a;

/**
 * Componentwise 1D strided vector division.
 *
 * @param out - output vector
 * @param a - input vector
 * @param b - input vector
 * @param io - index (default: 0)
 * @param ia - index (default: 0)
 * @param ib - index (default: 0)
 */
export const divS1 = b;

/**
 * Componentwise 2D strided vector division.
 *
 * @param out - output vector
 * @param a - input vector
 * @param b - input vector
 * @param io - index (default: 0)
 * @param ia - index (default: 0)
 * @param ib - index (default: 0)
 * @param so - stride (default: 1)
 * @param sa - stride (default: 1)
 * @param sb - stride (default: 1)
 */
export const divS2 = c;

/**
 * Componentwise 3D strided vector division.
 *
 * @param out - output vector
 * @param a - input vector
 * @param b - input vector
 * @param io - index (default: 0)
 * @param ia - index (default: 0)
 * @param ib - index (default: 0)
 * @param so - stride (default: 1)
 * @param sa - stride (default: 1)
 * @param sb - stride (default: 1)
 */
export const divS3 = d;

/**
 * Componentwise 4D strided vector division.
 *
 * @param out - output vector
 * @param a - input vector
 * @param b - input vector
 * @param io - index (default: 0)
 * @param ia - index (default: 0)
 * @param ib - index (default: 0)
 * @param so - stride (default: 1)
 * @param sa - stride (default: 1)
 * @param sb - stride (default: 1)
 */
export const divS4 = e;
