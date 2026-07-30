// SPDX-License-Identifier: Apache-2.0
import type { Maybe, NumericArray } from "@thi.ng/api";
import { typedArray, typedArrayOfVec } from "@thi.ng/api/typedarray";
import type { Pow2 } from "@thi.ng/binary";
import { isBoolean } from "@thi.ng/checks/is-boolean";
import { illegalArgs } from "@thi.ng/errors/illegal-arguments";
import { unsupportedOp } from "@thi.ng/errors/unsupported";
import {
	SpatialHash2,
	SpatialHash3,
	type ISpatialHash,
} from "@thi.ng/geom-accel/spatial-hash";
import type { Vec } from "@thi.ng/vectors";
import { add3 } from "@thi.ng/vectors/add";
import { divN } from "@thi.ng/vectors/divn";
import { floor } from "@thi.ng/vectors/floor";
import { normalize3 } from "@thi.ng/vectors/normalize";
import { orthoNormal3 } from "@thi.ng/vectors/ortho-normal";
import type { UncompiledModelSpec } from "@thi.ng/webgl";

export interface IndexedMeshFace {
	vertices: NumericArray;
	vnormals?: NumericArray;
	normal?: number;
	color?: number;
	colors?: NumericArray;
	uv?: NumericArray;
}

export interface IndexedMeshOpts {
	buckets?: Pow2;
	capacity?: number;
	vertices?: Vec[];
	faces?: IndexedMeshFace[];
	vnormals?: boolean | Vec[];
	fnormals?: boolean | Vec[];
	color?: boolean | Vec[];
	uv?: boolean | Vec[];
	eps?: number;
}

export interface FaceOpts {
	vertices: Vec[];
	normal?: Vec;
	color?: Vec;
	colors?: Vec[];
	uv?: Vec[];
}

export class IndexedMesh {
	hashV: ISpatialHash;
	hashVN: Maybe<ISpatialHash>;
	hashFN: Maybe<ISpatialHash>;
	hashColor: Maybe<ISpatialHash>;
	hashUV: Maybe<ISpatialHash>;

	vertices: Vec[];
	faces: IndexedMeshFace[];
	vedgeIndex: number[][] = [];
	vfaceIndex: number[][] = [];
	vnormals: Maybe<Vec[]>;
	fnormals: Maybe<Vec[]>;
	colors: Maybe<Vec[]>;
	uv: Maybe<Vec[]>;

	eps: number;

	useVN = false;
	useFN = false;
	useColor = false;
	useUV = false;

	constructor(opts: IndexedMeshOpts) {
		const buckets = opts.buckets ?? 0x1000;
		const capacity = opts.capacity ?? 0x400;
		const hashOpts = { buckets, capacity };
		this.eps = opts.eps ?? 1e-3;
		this.vertices = opts.vertices ?? [];
		this.hashV = new SpatialHash3(hashOpts);
		if (opts.vnormals != null) {
			if (isBoolean(opts.vnormals)) {
				this.useVN = opts.vnormals;
				this.vnormals = [];
			} else {
				this.vnormals = opts.vnormals ?? [];
				this.useVN = true;
			}
			if (this.useVN) {
				this.hashVN = new SpatialHash3(hashOpts);
			}
		}
		if (opts.fnormals != null) {
			if (isBoolean(opts.fnormals)) {
				this.useFN = opts.fnormals;
				this.fnormals = [];
			} else {
				this.fnormals = opts.fnormals ?? [];
				this.useFN = true;
			}
			if (this.useFN) {
				this.hashFN = new SpatialHash3(hashOpts);
			}
		}
		if (opts.color != null) {
			if (isBoolean(opts.color)) {
				this.useColor = opts.color;
				this.colors = [];
			} else {
				this.colors = opts.color ?? [];
				this.useColor = true;
			}
			if (this.useColor) {
				this.hashColor = new SpatialHash3(hashOpts);
			}
		}
		if (opts.uv != null) {
			if (isBoolean(opts.uv)) {
				this.useUV = opts.uv;
				this.uv = [];
			} else {
				this.uv = opts.uv ?? [];
				this.useUV = true;
			}
			if (this.useUV) {
				this.hashUV = new SpatialHash2(hashOpts);
			}
		}
		this.faces = opts.faces ?? [];
		this.reindex();
	}

	addFace(face: FaceOpts) {
		if (face.vertices.length < 3)
			illegalArgs("require at least 3 vertices");
		const result: IndexedMeshFace = {
			vertices: this.indexVecs(face.vertices, this.hashV, this.vertices),
		};
		if (face.normal && this.useFN) {
			result.normal = this.indexVec(
				face.normal,
				this.hashFN!,
				this.fnormals!
			);
		}
		if (this.useColor) {
			if (face.color) {
				result.color = this.indexVec(
					face.color,
					this.hashColor!,
					this.colors!
				);
			}
			if (face.colors) {
				result.colors = this.indexVecs(
					face.colors,
					this.hashColor!,
					this.colors!
				);
			}
		}
		if (face.uv && this.useUV) {
			result.uv = this.indexVecs(face.uv, this.hashUV!, this.uv!);
		}
		const id = this.faces.push(result) - 1;
		this.indexFaceVertices(result.vertices, id);
		this.indexFaceEdges(result.vertices);
		return face;
	}

	addFaces(faces: Iterable<FaceOpts>) {
		for (let f of faces) this.addFace(f);
		return this;
	}

	computeFaceNormals() {
		if (!this.useFN) unsupportedOp("face normals not enabled");
		this.fnormals = [];
		const { faces, fnormals, hashFN, vertices } = this;
		for (let f of faces) {
			const [a, b, c] = f.vertices;
			f.normal = this.indexVec(
				orthoNormal3([], vertices[a], vertices[b], vertices[c]),
				hashFN!,
				fnormals
			);
		}
		return this;
	}

	computeVertexNormals() {
		if (!(this.useVN && this.useFN))
			unsupportedOp("vertex normals not enabled");
		const { faces, fnormals, hashVN, vertices, vnormals, vfaceIndex } =
			this;
		const vnormalIndex: number[] = [];
		for (let i = 0; i < vertices.length; i++) {
			if (!vfaceIndex[i]) continue;
			let vn = [0, 0, 0];
			for (let f of vfaceIndex[i]) {
				add3(vn, vn, fnormals![faces[f].normal!]);
			}
			vnormalIndex[i] = this.indexVec(
				normalize3(vn, vn),
				hashVN!,
				vnormals!
			);
		}
		for (let f of faces) {
			f.vnormals = f.vertices.map((v) => vnormalIndex[v]);
		}
		return this;
	}

	reindex() {
		this.vedgeIndex = [];
		this.vfaceIndex = [];
		// TODO update spatial hashes
		for (let i = 0, n = this.faces.length; i < n; i++) {
			const verts = this.faces[i].vertices;
			this.indexFaceEdges(verts);
			this.indexFaceVertices(verts, i);
		}
	}

	protected indexFaceEdges(verts: NumericArray) {
		for (let n = verts.length, i = n - 1, j = 0; j < n; i = j, j++) {
			const a = verts[i];
			const b = verts[j];
			let neighbors = this.vedgeIndex[a];
			if (neighbors) {
				if (!neighbors.includes(b)) neighbors.push(b);
			} else this.vedgeIndex[a] = [b];
			neighbors = this.vedgeIndex[b];
			if (neighbors) {
				if (!neighbors.includes(a)) neighbors.push(a);
			} else this.vedgeIndex[b] = [a];
		}
	}

	protected indexFaceVertices(verts: NumericArray, faceID: number) {
		for (let vID of verts) {
			const faces = this.vfaceIndex[vID];
			if (faces) {
				if (!faces.includes(faceID)) faces.push(faceID);
			} else this.vfaceIndex[vID] = [faceID];
		}
	}

	protected indexVecs(vecs: Vec[], index: ISpatialHash, coll: Vec[]) {
		return vecs.map((v) => this.indexVec(v, index, coll));
	}

	protected indexVec(v: Vec, index: ISpatialHash, coll: Vec[]) {
		const $v = floor(null, divN([], v, this.eps));
		let id = index.closestValue($v);
		// let id = this.findClosestID($v, index, coll);
		if (id < 0) {
			id = index.size;
			index.add($v, id);
			coll[id] = v;
		}
		return id;
	}

	// FIXME unused
	// protected findClosestID(p: ReadonlyVec, hash: ISpatialHash, coll: Vec[]) {
	// 	let minD = Infinity;
	// 	let closest = -1;
	// 	for (let n of hash.queryValues(p)) {
	// 		const d = distSq(p, coll[n]);
	// 		if (d < minD) {
	// 			minD = d;
	// 			closest = n;
	// 		}
	// 	}
	// 	return closest;
	// }

	tessellate() {
		const newFaces: IndexedMeshFace[] = [];
		for (let f of this.faces) {
			const n = f.vertices.length - 1;
			if (n < 3) {
				newFaces.push(f);
				continue;
			}
			for (let i = 1; i < n; i++) {
				const ff: IndexedMeshFace = {
					vertices: [f.vertices[0], f.vertices[i], f.vertices[i + 1]],
				};
				if (f.normal != null) ff.normal = f.normal;
				if (f.vnormals) {
					ff.vnormals = [
						f.vnormals[0],
						f.vnormals[i],
						f.vnormals[i + 1],
					];
				}
				if (f.color != null) ff.color = f.color;
				if (f.colors) {
					ff.colors = [f.colors[0], f.colors[i], f.colors[i + 1]];
				}
				if (f.uv) {
					ff.uv = [f.uv[0], f.uv[i], f.uv[i + 1]];
				}
				newFaces.push(ff);
			}
		}
		this.faces = newFaces;
		return this;
	}

	asWebGL() {
		const spec: Omit<UncompiledModelSpec, "shader"> = {
			attribs: {},
			mode: WebGL2RenderingContext.TRIANGLES,
			num: 0,
		};
		let vertices: Vec[] = [];
		const normals: Vec[] = [];
		const colors: Vec[] = [];
		const uvs: Vec[] = [];
		const indices: number[] = [];
		const uniques = new Map<string, number>();
		let nextID = 0;
		if (this.useFN || this.useVN || this.useColor || this.useUV) {
			for (let f of this.faces) {
				for (let i = 0; i < 3; i++) {
					const id: any[] = [f.vertices[i]];
					if (f.vnormals) id.push(f.vnormals[i]);
					else if (f.normal != null) id.push(f.normal!);
					else id.push("");
					if (f.colors) id.push(f.colors[i]);
					else if (f.color != null) id.push(f.color);
					else id.push("");
					if (f.uv) id.push(f.uv[i]);
					const hash = id.join("|");
					const uniqueID = uniques.get(hash);
					if (uniqueID != null) {
						indices.push(uniqueID);
					} else {
						vertices.push(this.vertices[f.vertices[i]]);
						if (f.vnormals) {
							normals.push(this.vnormals![f.vnormals![i]]);
						} else if (f.normal != null) {
							normals.push(this.fnormals![f.normal]);
						}
						if (f.colors) {
							colors.push(this.colors![f.colors[i]]);
						} else if (f.color != null) {
							colors.push(this.colors![f.color]);
						}
						if (f.uv) uvs.push(this.uv![f.uv[i]]);
						uniques.set(hash, nextID);
						indices.push(nextID);
						nextID++;
					}
				}
			}
		} else {
			vertices = this.vertices;
			for (let f of this.faces) indices.push(...f.vertices);
		}
		spec.attribs.position = {
			data: typedArrayOfVec("f32", vertices),
			size: vertices[0].length,
		};
		if (this.useFN || this.useVN) {
			spec.attribs.normal = {
				data: typedArrayOfVec("f32", normals),
				size: 3,
			};
		}
		if (this.useColor) {
			spec.attribs.color = {
				data: typedArrayOfVec("f32", colors),
				size: colors[0].length,
			};
		}
		if (this.useUV) {
			spec.attribs.uv = {
				data: typedArrayOfVec("f32", uvs),
				size: uvs[0].length,
			};
		}
		spec.indices = {
			data: typedArray(
				indices.length <= 0x10000 ? "u16" : "u32",
				indices
			),
		};
		spec.num = indices.length;
		return spec;
	}
}
