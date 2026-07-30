// SPDX-License-Identifier: Apache-2.0
import type { Fn, IClear, NumericArray, Pair } from "@thi.ng/api";
import type { Pow2 } from "@thi.ng/binary";
import { rangeNd } from "@thi.ng/transducers";
import { map } from "@thi.ng/transducers/map";
import type { ReadonlyVec, Vec } from "@thi.ng/vectors";
import { addN } from "@thi.ng/vectors/addn";
import { distSqS, distSqS2, distSqS3 } from "@thi.ng/vectors/distsqs";
import { floor } from "@thi.ng/vectors/floor";
import { hash as $hash, hash2, hash3, hash4 } from "@thi.ng/vectors/hash";
import { subN } from "@thi.ng/vectors/subn";

export interface ISpatialHash
	extends IClear, Iterable<Pair<ReadonlyVec, number>> {
	readonly size: number;
	add(k: ReadonlyVec, id: number): void;
	remove(k: ReadonlyVec, id: number): boolean;
	get(k: ReadonlyVec): number[];
	has(k: ReadonlyVec): boolean;
	closestValue(k: ReadonlyVec, radius?: number): number;
	query(
		k: ReadonlyVec,
		radius?: number
	): IterableIterator<Pair<ReadonlyVec, number>>;
	queryKeys(k: ReadonlyVec, radius?: number): IterableIterator<ReadonlyVec>;
	queryValues(k: ReadonlyVec, radius?: number): IterableIterator<number>;
	stats(): SpatialHashStats;
}

export interface SpatialHashStats {
	size: number;
	numBuckets: number;
	usedBuckets: number;
	bucketUseRatio: number;
	bucketSizes: NumericArray;
	min: number;
	max: number;
	mean: number;
}

export interface SpatialHashOpts {
	buckets: Pow2;
	capacity: number;
	hash: HashFn;
}

export type HashFn = Fn<ReadonlyVec, number>;

export class SpatialHashNd implements ISpatialHash {
	protected hash: HashFn;
	protected mask: number;
	protected head: Int32Array<ArrayBuffer>;
	protected next: Int32Array<ArrayBuffer>;
	protected keys: Int32Array<ArrayBuffer>;
	protected values: Uint32Array<ArrayBuffer>;
	protected _size = 0;

	constructor(
		public dim: number,
		{
			buckets = 0x1000,
			capacity = 0x400,
			hash,
		}: Partial<SpatialHashOpts> = {}
	) {
		this.mask = buckets - 1;
		this.head = new Int32Array(buckets);
		this.head.fill(-1);
		this.next = new Int32Array(capacity);
		this.values = new Uint32Array(capacity);
		this.keys = new Int32Array(capacity * dim);
		this.hash =
			hash ??
			(dim === 2 ? hash2 : dim === 3 ? hash3 : dim === 4 ? hash4 : $hash);
	}

	get size() {
		return this._size;
	}

	*[Symbol.iterator]() {
		const { dim, head, next, keys, values } = this;
		for (let i = 0, offset; i < head.length; i++) {
			if (head[i] == -1) continue;
			for (let j = head[i]; j !== -1; j = next[j]) {
				offset = j * dim;
				yield <Pair<ReadonlyVec, number>>[
					keys.slice(offset, offset + dim),
					values[j],
				];
			}
		}
	}

	clear() {
		this.head.fill(-1);
		this._size = 0;
	}

	add(p: ReadonlyVec, v: number) {
		if (this._size === this.next.length) this.resize();
		const bucket = this.hash(p) & this.mask;
		const n = this._size++;
		this.keys.set(p, n * this.dim);
		this.values[n] = v;
		this.next[n] = this.head[bucket];
		this.head[bucket] = n;
	}

	remove(p: ReadonlyVec, v: number) {
		const { dim, keys, next, values } = this;
		const bucket = this.hash(p) & this.mask;
		let j: number, k: number;
		for (
			let i = this.head[bucket], prev = -1;
			i !== -1;
			prev = i, i = next[i]
		) {
			if (values[i] !== v) continue;
			j = dim;
			k = i * dim;
			while (j-- > 0 && p[j] === keys[k + j]);
			if (j < 0) {
				if (prev !== -1) next[prev] = next[i];
				else this.head[bucket] = next[i];
				next[i] = -1;
				return true;
			}
		}
		return false;
	}

	get(p: ReadonlyVec) {
		const { dim, keys, next, values } = this;
		const result: number[] = [];
		let j: number, k: number;
		for (
			let e = this.head[this.hash(p) & this.mask];
			e !== -1;
			e = next[e]
		) {
			j = dim;
			k = e * dim;
			while (j-- > 0 && p[j] === keys[k + j]);
			if (j < 0) result.push(values[e]);
		}
		return result;
	}

	has(p: ReadonlyVec) {
		const { dim, keys, next } = this;
		let j: number, k: number;
		for (
			let i = this.head[this.hash(p) & this.mask];
			i !== -1;
			i = next[i]
		) {
			j = dim;
			k = i * dim;
			while (j-- > 0 && p[j] === keys[k + j]);
			if (j < 0) return true;
		}
		return false;
	}

	*query(p: ReadonlyVec, r = 1): IterableIterator<Pair<ReadonlyVec, number>> {
		for (let q of rangeNd(...this.queryRange(p, r))) {
			yield* map((v) => [q, v], this.get(q));
		}
	}

	*queryKeys(p: ReadonlyVec, r = 1): IterableIterator<ReadonlyVec> {
		for (let q of rangeNd(...this.queryRange(p, r))) {
			if (this.has(q)) yield q;
		}
	}

	*queryValues(p: ReadonlyVec, r = 1): IterableIterator<number> {
		for (let q of rangeNd(...this.queryRange(p, r))) {
			yield* this.get(q);
		}
	}

	closestValue(p: ReadonlyVec, r = 1) {
		const { dim, keys, next, values } = this;
		let j: number, k: number;
		let minD = Infinity;
		let closest = -1;
		for (let q of rangeNd(...this.queryRange(p, r))) {
			for (
				let i = this.head[this.hash(q) & this.mask];
				i !== -1;
				i = next[i]
			) {
				j = dim;
				k = i * dim;
				while (j-- > 0 && q[j] === keys[k + j]);
				if (j < 0) {
					const d = distSqS(q, keys, dim, 0, k);
					if (d < minD) {
						minD = d;
						closest = values[i];
					}
				}
			}
		}
		return closest;
	}

	stats(): SpatialHashStats {
		const { head, next, size } = this;
		const numBuckets = head.length;
		const bucketSizes = new Uint32Array(numBuckets);
		let usedBuckets = 0;
		let min = Infinity;
		let max = -Infinity;
		for (let i = 0; i < numBuckets; i++) {
			if (head[i] === -1) continue;
			usedBuckets++;
			let length = 0;
			for (let j = head[i]; j !== -1; length++, j = next[j]);
			bucketSizes[i] = length;
			min = Math.min(min, length);
			max = Math.max(max, length);
		}
		return {
			size,
			numBuckets,
			usedBuckets,
			bucketUseRatio: usedBuckets / numBuckets,
			bucketSizes,
			min,
			max,
			mean: size / usedBuckets,
		};
	}

	protected queryRange(
		p: ReadonlyVec,
		r: number
	): [ReadonlyVec, ReadonlyVec] {
		p = floor([], p);
		r |= 0;
		return [subN([], p, r), addN(p, p, r + 1)];
	}

	protected resize() {
		const n = this.next.length * 2;
		const next = new Int32Array(n);
		next.set(this.next);
		this.next = next;

		const keys = new Int32Array(n * this.dim);
		keys.set(this.keys);
		this.keys = keys;

		const values = new Uint32Array(n);
		values.set(this.values);
		this.values = values;
	}
}

export class SpatialHash2 extends SpatialHashNd {
	constructor(opts?: Partial<SpatialHashOpts>) {
		super(2, opts);
	}

	get(p: ReadonlyVec) {
		const { keys, next, values } = this;
		const [px, py] = p;
		const result: number[] = [];
		let j: number;
		for (
			let i = this.head[this.hash(p) & this.mask];
			i !== -1;
			i = next[i]
		) {
			j = i << 1;
			if (px === keys[j] && py === keys[j + 1]) {
				result.push(values[i]);
			}
		}
		return result;
	}

	has(p: ReadonlyVec) {
		const { keys, next } = this;
		const [px, py] = p;
		let j: number;
		for (
			let i = this.head[this.hash(p) & this.mask];
			i !== -1;
			i = next[i]
		) {
			j = i << 1;
			if (px === keys[j] && py === keys[j + 1]) {
				return true;
			}
		}
		return false;
	}

	*query(p: ReadonlyVec, r = 1): IterableIterator<Pair<ReadonlyVec, number>> {
		const [[x1, y1], [x2, y2]] = this.queryRange(p, r);
		for (let x = x1; x < x2; x++) {
			for (let y = y1; y < y2; y++) {
				const q = [x, y];
				yield* this.get(q).map(
					(v) => <Pair<ReadonlyVec, number>>[q, v]
				);
			}
		}
	}

	*queryKeys(p: ReadonlyVec, r = 1): IterableIterator<ReadonlyVec> {
		const [[x1, y1], [x2, y2]] = this.queryRange(p, r);
		for (let x = x1; x < x2; x++) {
			for (let y = y1; y < y2; y++) {
				const q = [x, y];
				if (this.has(q)) yield q;
			}
		}
	}

	*queryValues(p: ReadonlyVec, r = 1): IterableIterator<number> {
		const [[x1, y1], [x2, y2]] = this.queryRange(p, r);
		const q: Vec = [];
		for (let x = x1; x < x2; x++) {
			q[0] = x;
			for (let y = y1; y < y2; y++) {
				q[1] = y;
				yield* this.get(q);
			}
		}
	}

	closestValue(p: ReadonlyVec, r = 1) {
		const { keys, next, values } = this;
		const [[x1, y1], [x2, y2]] = this.queryRange(p, r);
		const q: number[] = [];
		let minD = Infinity;
		let closest = -1;
		let j: number;
		for (let x = x1; x < x2; x++) {
			q[0] = x;
			for (let y = y1; y < y2; y++) {
				q[1] = y;
				for (
					let i = this.head[this.hash(q) & this.mask];
					i !== -1;
					i = next[i]
				) {
					j = i << 1;
					if (x === keys[j] && y === keys[j + 1]) {
						const d = distSqS2(q, keys, 0, j);
						if (d < minD) {
							minD = d;
							closest = values[i];
						}
					}
				}
			}
		}
		return closest;
	}
}

export class SpatialHash3 extends SpatialHashNd {
	constructor(opts?: Partial<SpatialHashOpts>) {
		super(3, opts);
	}

	get(p: ReadonlyVec) {
		const { keys, next, values } = this;
		const [px, py, pz] = p;
		const result: number[] = [];
		let j: number;
		for (
			let i = this.head[this.hash(p) & this.mask];
			i !== -1;
			i = next[i]
		) {
			j = i * 3;
			if (px === keys[j] && py === keys[j + 1] && pz === keys[j + 2]) {
				result.push(values[i]);
			}
		}
		return result;
	}

	has(p: ReadonlyVec) {
		const { keys, next } = this;
		const [px, py, pz] = p;
		let j: number;
		for (
			let i = this.head[this.hash(p) & this.mask];
			i !== -1;
			i = next[i]
		) {
			j = i * 3;
			if (px === keys[j] && py === keys[j + 1] && pz === keys[j + 2]) {
				return true;
			}
		}
		return false;
	}

	*query(p: ReadonlyVec, r = 1): IterableIterator<Pair<ReadonlyVec, number>> {
		const [[x1, y1, z1], [x2, y2, z2]] = this.queryRange(p, r);
		for (let x = x1; x < x2; x++) {
			for (let y = y1; y < y2; y++) {
				for (let z = z1; z < z2; z++) {
					const q = [x, y, z];
					yield* this.get(q).map(
						(v) => <Pair<ReadonlyVec, number>>[q, v]
					);
				}
			}
		}
	}

	*queryKeys(p: ReadonlyVec, r = 1): IterableIterator<ReadonlyVec> {
		const [[x1, y1, z1], [x2, y2, z2]] = this.queryRange(p, r);
		for (let x = x1; x < x2; x++) {
			for (let y = y1; y < y2; y++) {
				for (let z = z1; z < z2; z++) {
					const q = [x, y, z];
					if (this.has(q)) yield q;
				}
			}
		}
	}

	*queryValues(p: ReadonlyVec, r = 1): IterableIterator<number> {
		const [[x1, y1, z1], [x2, y2, z2]] = this.queryRange(p, r);
		const q: Vec = [];
		for (let x = x1; x < x2; x++) {
			q[0] = x;
			for (let y = y1; y < y2; y++) {
				q[1] = y;
				for (let z = z1; z < z2; z++) {
					q[2] = z;
					yield* this.get(q);
				}
			}
		}
	}

	closestValue(p: ReadonlyVec, r = 1) {
		const { keys, next, values } = this;
		const [[x1, y1, z1], [x2, y2, z2]] = this.queryRange(p, r);
		const q: number[] = [];
		let minD = Infinity;
		let closest = -1;
		let j: number;
		for (let x = x1; x < x2; x++) {
			q[0] = x;
			for (let y = y1; y < y2; y++) {
				q[1] = y;
				for (let z = z1; z < z2; z++) {
					q[2] = z;
					for (
						let i = this.head[this.hash(q) & this.mask];
						i !== -1;
						i = next[i]
					) {
						j = i * 3;
						if (
							x === keys[j] &&
							y === keys[j + 1] &&
							z === keys[j + 2]
						) {
							const d = distSqS3(q, keys, 0, j);
							if (d < minD) {
								minD = d;
								closest = values[i];
							}
						}
					}
				}
			}
		}
		return closest;
	}
}
