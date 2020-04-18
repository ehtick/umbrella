import * as assert from "assert";
import { parseOBJ } from "../src";

const src = `
# test cube

mtllib cube.mtl
usemtl noise

o cube
v 1.0000 1.0000 1.0000
v 1.0000 1.0000 0.0000
v 1.0000 0.0000 0.0000
v 1.0000 0.0000 1.0000
v 0.0000 1.0000 0.0000
v 0.0000 1.0000 1.0000
v 0.0000 0.0000 1.0000
v 0.0000 0.0000 0.0000

# quad faces
f 4 3 2 1
f 8 7 6 5
f 6 1 2 5
g other
s
f 8 3 4 7
f 7 4 1 6
f 3 8 5 2
`;

const cubeVerts = [
    [1, 1, 1],
    [1, 1, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 1, 0],
    [0, 1, 1],
    [0, 0, 1],
    [0, 0, 0],
];

const cubeFaces = [
    { v: [3, 2, 1, 0] },
    { v: [7, 6, 5, 4] },
    { v: [5, 0, 1, 4] },
    { v: [7, 2, 3, 6] },
    { v: [6, 3, 0, 5] },
    { v: [2, 7, 4, 1] },
];

describe("geom-io-obj", () => {
    it("cube (default)", () => {
        const model = parseOBJ(src);
        assert.deepEqual(model.vertices, cubeVerts);
        assert.equal(model.objects.length, 2);
        assert.equal(model.objects[1].id, "cube");
        assert.deepEqual(model.objects[1].groups, [
            {
                id: "default",
                smooth: false,
                mtl: "noise",
                lines: [],
                faces: cubeFaces.slice(0, 3),
            },
            {
                id: "other",
                smooth: true,
                mtl: "noise",
                lines: [],
                faces: cubeFaces.slice(3),
            },
        ]);
        assert.deepEqual(model.mtlLibs, ["cube.mtl"]);
    });

    it("cube (no obj, no groups)", () => {
        const model = parseOBJ(src, { objects: false, groups: false });
        assert.deepEqual(model.vertices, cubeVerts);
        assert.equal(model.objects.length, 1);
        assert.equal(model.objects[0].id, "default");
        assert.deepEqual(model.objects[0].groups, [
            {
                id: "default",
                smooth: true,
                mtl: "noise",
                lines: [],
                faces: cubeFaces,
            },
        ]);
    });

    it("cube (tessel)", () => {
        const model = parseOBJ(src, {
            objects: false,
            groups: false,
            tessellate: true,
        });
        assert.deepEqual(model.objects[0].groups, [
            {
                id: "default",
                smooth: true,
                mtl: "noise",
                lines: [],
                faces: [
                    { v: [3, 2, 1] },
                    { v: [3, 1, 0] },
                    { v: [7, 6, 5] },
                    { v: [7, 5, 4] },
                    { v: [5, 0, 1] },
                    { v: [5, 1, 4] },
                    { v: [7, 2, 3] },
                    { v: [7, 3, 6] },
                    { v: [6, 3, 0] },
                    { v: [6, 0, 5] },
                    { v: [2, 7, 4] },
                    { v: [2, 4, 1] },
                ],
            },
        ]);
    });

    it("comments", () => {
        const model = parseOBJ(src, { comments: true });
        assert.deepEqual(model.comments, ["test cube", "quad faces"]);
    });
});
