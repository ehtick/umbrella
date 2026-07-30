// SPDX-License-Identifier: Apache-2.0
import { defArcBall, defArcballController } from "@thi.ng/arcball";
import { aabbFromCentroid, asPolygon } from "@thi.ng/geom";
import { parseOBJFromStream } from "@thi.ng/geom-io-obj";
import { IndexedMesh } from "@thi.ng/geom-mesh";
import { perspective } from "@thi.ng/matrices";
import { zip } from "@thi.ng/transducers/zip";
import { fit11_3, ONE3, ZERO3 } from "@thi.ng/vectors";
import {
	clearCanvas,
	compileModel,
	draw,
	glCanvas,
	PHONG,
	type GLMat4,
	type UncompiledModelSpec,
} from "@thi.ng/webgl";
import MODEL_URL from "./bunny.obj?url";

// create a colored cube mesh form a thi.ng/geom AABB and manually assigned face
// colors. the mesh faces are initially quads, but will then be tessellated into
// triangles
const cubeMesh = () => {
	const mesh = new IndexedMesh({ color: true, fnormals: true });
	for (let [f, color] of zip(
		asPolygon(aabbFromCentroid([0, 0, 0], [2, 2, 2])),
		[
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1],
			[1, 1, 0],
			[1, 0, 1],
			[0, 1, 1],
		]
	)) {
		mesh.addFace({ vertices: f.points, color });
	}
	mesh.tessellate();
	mesh.computeFaceNormals();
	return mesh;
};

// load OBJ model and convert to mesh with re-computed face & vertex normals
const objMesh = async () => {
	const response = await fetch(MODEL_URL);
	const objModel = await parseOBJFromStream(response.body!, {
		objects: false,
		groups: false,
	});
	const verts = objModel.vertices;
	const faces = objModel.objects[0].groups[0].faces.map((f) =>
		f.v.map((v) => verts[v])
	);
	// re-build as mesh
	const mesh = new IndexedMesh({
		buckets: 0x10000,
		capacity: verts.length,
		color: true,
		fnormals: true,
		vnormals: true,
		eps: 1e-3,
	});
	for (let f of faces) {
		mesh.addFace({
			vertices: f,
			color: fit11_3([], f[0], ZERO3, ONE3),
		});
	}
	mesh.tessellate();
	mesh.computeFaceNormals();
	mesh.computeVertexNormals();
	return mesh;
};

const W = Math.min(window.innerWidth - 32, window.innerHeight - 96);

const { canvas, gl } = glCanvas({
	width: W,
	height: W,
	parent: document.getElementById("app")!,
});

// const mesh = cubeMesh();
const mesh = await objMesh();
console.log(mesh, mesh.hashV.stats());

const model = compileModel(gl, <UncompiledModelSpec>{
	shader: PHONG({ color: "color" }),
	uniforms: {
		proj: <GLMat4>perspective([], 60, 1, 0.1, 10),
		lightDir: [0, 1, 1],
		shininess: 100,
	},
	...mesh.asWebGL(),
});

console.log(model);

const arcball = defArcBall(canvas.width, canvas.height, { eyeDist: 4 });

// redraw function, uses arcball's current view matrix
const redraw = () => {
	model.uniforms!.view = <GLMat4>arcball.viewMat;
	clearCanvas(gl, [0.8, 0.8, 0.8, 1]);
	draw(model);
};

// initial draw
redraw();

// attach gesture stream to canvas and delegate events to arcball this is an
// abstraction over both mouse, touch and wheel events. in our case the scene
// will only be redrawn when a gesture event required it...
defArcballController(canvas, arcball, {
	onUpdate: redraw,
	minZoom: 1,
	maxZoom: 8,
});
