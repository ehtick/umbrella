// SPDX-License-Identifier: Apache-2.0
import type { Vec4Sym } from "@thi.ng/shader-ast/api/syms";
import { M2, M3, M4 } from "@thi.ng/shader-ast/api/types";
import { defn, ret } from "@thi.ng/shader-ast/ast/function";
import { indexMat } from "@thi.ng/shader-ast/ast/indexed";
import { VEC3_0, mat3, mat4, vec3, vec4 } from "@thi.ng/shader-ast/ast/lit";
import { div } from "@thi.ng/shader-ast/ast/ops";
import { $w, $xyz } from "@thi.ng/shader-ast/ast/swizzle";

export const m22ToM33 = defn(M3, "m22ToM33", [M2], (m) => {
	return [
		ret(mat3(vec3(indexMat(m, 0), 0), vec3(indexMat(m, 1), 0), VEC3_0)),
	];
});

export const m33ToM44 = defn(M4, "m33ToM44", [M3], (m) => {
	return [
		ret(
			mat4(
				vec4(indexMat(m, 0), 0),
				vec4(indexMat(m, 1), 0),
				vec4(indexMat(m, 2), 0),
				vec4()
			)
		),
	];
});

/**
 * Applies perpspective divide on given vector, i.e. `v.xyz / v.w`.
 *
 * @param v
 */
export const perspectiveDivide = (v: Vec4Sym) => div($xyz(v), $w(v));
