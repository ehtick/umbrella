// SPDX-License-Identifier: Apache-2.0
import { defOpSVV } from "./defopsvv.js";
import { $add } from "./ops.js";

const [a, b, c, d, e] = defOpSVV($add);

/**
 * Componentwise nD strided vector addition.
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
export const addS = a;

/**
 * Componentwise 1D strided vector addition.
 *
 * @param out - output vector
 * @param a - input vector
 * @param b - input vector
 * @param io - index (default: 0)
 * @param ia - index (default: 0)
 * @param ib - index (default: 0)
 */
export const addS1 = b;

/**
 * Componentwise 2D strided vector addition.
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
export const addS2 = c;

/**
 * Componentwise 3D strided vector addition.
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
export const addS3 = d;

/**
 * Componentwise 4D strided vector addition.
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
export const addS4 = e;
