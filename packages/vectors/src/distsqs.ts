// SPDX-License-Identifier: Apache-2.0
import type { DistanceSFn, VecOpSGRoVV } from "./api.js";

/**
 * Computes the squared Eucledian distance between given 2D strided vectors.
 */
export const distSqS2: DistanceSFn = (a, b, ia = 0, ib = 0, sa = 1, sb = 1) => {
	const dx = a[ia] - b[ib];
	const dy = a[ia + sa] - b[ib + sb];
	return dx * dx + dy * dy;
};

/**
 * Computes the squared Eucledian distance between given 3D strided vectors.
 */
export const distSqS3: DistanceSFn = (a, b, ia = 0, ib = 0, sa = 1, sb = 1) => {
	const dx = a[ia] - b[ib];
	const dy = a[ia + sa] - b[ib + sb];
	const dz = a[ia + 2 * sa] - b[ib + 2 * sb];
	return dx * dx + dy * dy + dz * dz;
};

/**
 * Computes the squared Eucledian distance between given 4D strided vectors.
 */
export const distSqS4: DistanceSFn = (a, b, ia = 0, ib = 0, sa = 1, sb = 1) => {
	const dx = a[ia] - b[ib];
	const dy = a[ia + sa] - b[ib + sb];
	const dz = a[ia + 2 * sa] - b[ib + 2 * sb];
	const dw = a[ia + 3 * sa] - b[ib + 3 * sb];
	return dx * dx + dy * dy + dz * dz + dw * dw;
};

/**
 * Computes the squared Eucledian distance between given nD strided vectors.
 */
export const distSqS: VecOpSGRoVV<number> = (
	a,
	b,
	num,
	ia = 0,
	ib = 0,
	sa = 1,
	sb = 1
) => {
	let sum = 0;
	for (let i = 0; i < num; i++) {
		const d = a[ia + i * sa] - b[ib + i * sb];
		sum += d * d;
	}
	return sum;
};
