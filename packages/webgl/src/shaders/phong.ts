// SPDX-License-Identifier: Apache-2.0
import type { FloatSym, Vec3Sym } from "@thi.ng/shader-ast";
import { perspectiveDivide } from "@thi.ng/shader-ast-stdlib/matrix/convert";
import { transformMVP } from "@thi.ng/shader-ast-stdlib/matrix/mvp";
import { surfaceNormal } from "@thi.ng/shader-ast-stdlib/matrix/normal";
import { F, M4, S2D, V2, V3 } from "@thi.ng/shader-ast/api/types";
import { assign } from "@thi.ng/shader-ast/ast/assign";
import { defMain } from "@thi.ng/shader-ast/ast/function";
import { FLOAT0, vec4 } from "@thi.ng/shader-ast/ast/lit";
import { add, mul } from "@thi.ng/shader-ast/ast/ops";
import { $xyz } from "@thi.ng/shader-ast/ast/swizzle";
import { sym } from "@thi.ng/shader-ast/ast/sym";
import { dot, max, normalize, pow } from "@thi.ng/shader-ast/builtin/math";
import { texture } from "@thi.ng/shader-ast/builtin/texture";
import type { Material } from "../api/material.js";
import type { ShaderPresetOpts, ShaderSpec } from "../api/shader.js";
import { defMaterial } from "../material.js";
import { autoNormalMatrix2 } from "../matrices.js";
import { colorAttrib, positionAttrib } from "../utils.js";

export type PhongOpts = ShaderPresetOpts<
	Pick<Material, "ambientCol" | "diffuseCol" | "specularCol">
>;

export const PHONG = (opts: Partial<PhongOpts> = {}): ShaderSpec => ({
	vs: (gl, unis, ins, outs) => [
		defMain(() => [
			assign(
				gl.gl_Position,
				transformMVP(
					positionAttrib(opts, ins),
					unis.model,
					unis.view,
					unis.proj
				)
			),
			assign(outs.vposition, perspectiveDivide(gl.gl_Position)),
			assign(outs.vnormal, surfaceNormal(ins.normal, unis.normalMat)),
			assign(outs.vcolor, colorAttrib(opts, ins, unis.diffuseCol)),
			opts.uv ? assign(outs.vuv, ins[opts.uv]) : null,
		]),
	],
	fs: (_, unis, ins, outs) => [
		defMain(() => {
			let normal: Vec3Sym;
			let lightDir: Vec3Sym;
			let halfDir: Vec3Sym;
			let diffuse: FloatSym;
			let specular: FloatSym;
			return [
				(normal = sym(normalize(ins.vnormal))),
				(lightDir = sym(normalize(unis.lightDir))),
				(halfDir = sym(
					normalize(add(normalize(ins.vposition), lightDir))
				)),
				(diffuse = sym(max(dot(normal, lightDir), FLOAT0))),
				(specular = sym(
					pow(max(dot(halfDir, normal), FLOAT0), unis.shininess)
				)),
				assign(
					outs.fragColor,
					vec4(
						add(
							unis.ambientCol,
							add(
								mul(
									opts.uv
										? mul(
												$xyz(
													texture(unis.tex, ins.vuv)
												),
												ins.vcolor
											)
										: ins.vcolor,
									diffuse
								),
								mul(unis.specularCol, specular)
							)
						),
						1
					)
				),
			];
		}),
	],
	attribs: {
		position: V3,
		normal: V3,
		...(opts.uv ? { [opts.uv]: V2 } : null),
		...(opts.color && !opts.instanceColor ? { [opts.color]: V3 } : null),
		...(opts.instancePos ? { [opts.instancePos]: V3 } : null),
		...(opts.instanceColor ? { [opts.instanceColor]: V3 } : null),
	},
	varying: {
		vposition: V3,
		vnormal: V3,
		vcolor: V3,
		...(opts.uv ? { vuv: V2 } : null),
	},
	uniforms: {
		model: M4,
		view: M4,
		proj: M4,
		normalMat: [M4, autoNormalMatrix2()],
		shininess: [F, 32],
		lightDir: [V3, [0, 1, 0]],
		...defMaterial(opts.material),
		...(opts.uv ? { tex: S2D } : null),
	},
	state: {
		depth: true,
		cull: true,
		...opts.state,
	},
});
