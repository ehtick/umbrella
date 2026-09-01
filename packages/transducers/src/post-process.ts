import type { Fn } from "@thi.ng/api";
import type { Reducer } from "./api.js";
import { isReduced, reduced } from "./reduced.js";

/**
 * Helper function to post-process the result of an existing {@link Reducer}
 * using the provided final transformation function. Returns a new reducer which
 * augments the completion function of the given reducer.
 *
 * @example
 * ```ts tangle:../export/post-process.ts
 * import { postProcess, push, range, take, transduce } from "@thi.ng/transducers";
 *
 * // initial setup
 * console.log(transduce(take(5), push(), range()));
 * // [ 0, 1, 2, 3, 4 ]
 *
 * // now augment reducer to post-process final result
 * console.log(
 *   transduce(take(5), postProcess(push(), x => x.join("|")), range())
 * );
 * // 0|1|2|3|4
 * ```
 *
 * @param rfn
 * @param fn
 */
export const postProcess = <A, B, C>(
	rfn: Reducer<A, B>,
	fn: Fn<B, C>
): Reducer<A, C> =>
	<any>[
		rfn[0],
		(x: any) => {
			const res = rfn[1](x);
			return isReduced(res) ? reduced(fn(<B>res.deref())) : fn(res);
		},
		rfn[2],
	];
