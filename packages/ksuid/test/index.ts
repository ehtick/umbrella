import { XsAdd } from "@thi.ng/random";
import * as assert from "assert";
import { defKSUID32, defKSUID64, defULID, IKSUID } from "../src";

describe("ksuid", () => {
    const check = (id: IKSUID, eps: number, buf: Uint8Array) => {
        const t = Date.now();
        const a = id.timeOnly(t);
        assert.strictEqual(a.length, id.encodedSize);
        let res = id.parse(a);
        assert(Math.abs(res.epoch - t) < eps);
        assert.deepStrictEqual(res.id, new Uint8Array(id.size - id.epochSize));
        const b = id.nextBinary();
        assert.deepStrictEqual(b.slice(id.epochSize), buf);
        res = id.parse(id.format(b));
        assert(Math.abs(res.epoch - t) < eps);
        assert.deepStrictEqual(res.id, buf);
    };

    it("ksuid32", () => {
        check(
            defKSUID32({ rnd: new XsAdd(0xdecafbad) }),
            1000 * 2,
            new Uint8Array([
                170, 213, 122, 63, 189, 122, 161, 143, 91, 187, 80, 231, 61, 17,
                112, 238,
            ])
        );
    });

    it("ksuid64", () => {
        check(
            defKSUID64({ rnd: new XsAdd(0xdecafbad) }),
            1 * 2,
            new Uint8Array([
                189, 122, 161, 143, 91, 187, 80, 231, 61, 17, 112, 238,
            ])
        );
    });

    it("ulid", () => {
        check(
            defULID({ rnd: new XsAdd(0xdecafbad) }),
            1 * 2,
            new Uint8Array([161, 143, 91, 187, 80, 231, 61, 17, 112, 238])
        );
    });
});
