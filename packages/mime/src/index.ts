// SPDX-License-Identifier: Apache-2.0
import { DB as $DB } from "./generated.js";

/**
 * Local mutable copy
 *
 * @internal
 */
const DB = { ...$DB };

/**
 * Decodes list of extensions, taking compressible flag into account.
 *
 * @internal
 */
const __ext = (val: string) => val.substring(~~(val[0] === "1")).split(",");

/**
 * Returns raw list-string of file extensions registered for given MIME type.
 *
 * @internal
 */
const __group = (mime: string) => {
	const [prefix, suffix] = mime.split("/");
	const group = DB[prefix];
	return group ? group[suffix] : undefined;
};

// https://www.iana.org/assignments/media-types/

export const MIME_TYPES = ((defs: any) => {
	const res: Record<string, string[]> = {};
	for (const groupID in defs) {
		const group = defs[groupID];
		for (const type in group) {
			const mime = groupID + "/" + type;
			for (const e of __ext(group[type])) {
				const isLowPri = e[0] === "*";
				const ext = isLowPri ? e.substring(1) : e;
				let coll = res[ext];
				!coll && (coll = res[ext] = []);
				isLowPri ? coll.push(mime) : coll.unshift(mime);
			}
		}
	}
	return res;
})(DB);

/**
 * Registers or overwrites a file `ext`ension with given MIME `types`. The first
 * type given will be used by {@link preferredType}. The `compressible` flag
 * will be used by {@link isCompressible}.
 *
 * @param ext
 * @param types
 * @param compressible
 */
export const register = (
	ext: string,
	types: string[],
	compressible = false
) => {
	MIME_TYPES[ext] = types;
	const $ext = (compressible ? "1" : "") + ext;
	for (const type of types) {
		const [prefix, suffix] = type.split("/");
		const group = DB[prefix];
		if (group) group[suffix] = $ext;
		else DB[prefix] = { [suffix]: $ext };
	}
};

/**
 * Returns preferred MIME type for given file extension `ext`, or if no match is
 * available, the `fallback` MIME type (default: `application/octet-stream`).
 * `ext` is converted to lowercase first.
 *
 * @remarks
 * Since v0.2.0 the extension can be given as either `".ext"` or `"ext"`.
 * Previously, only the latter was supported.
 *
 * Also see {@link preferredExtension} for reverse operation.
 *
 * @param ext -
 * @param fallback -
 */
export const preferredType = (ext: string, fallback = MIME_TYPES.bin[0]) => {
	ext = ext.toLowerCase();
	const type = MIME_TYPES[ext[0] === "." ? ext.substring(1) : ext];
	return type ? type[0] : fallback;
};

/**
 * Similar to {@link preferredType}, but accepts a file path and first
 * auto-extracts file extension.
 *
 * @param path
 * @param fallback
 */
export const preferredTypeForPath = (path: string, fallback?: string) =>
	preferredType(path.substring(path.lastIndexOf(".")), fallback);

/**
 * Reverse lookup to {@link preferredType}. Takes MIME type string and returns
 * preferred file extension (or failing that) returns `fallback` (default:
 * "bin").
 *
 * @param mime -
 * @param fallback -
 */
export const preferredExtension = (mime: string, fallback = "bin") => {
	const group = __group(mime);
	const ext = group ? __ext(group) : undefined;
	return ext
		? ext.find((x) => x[0] !== "*") || ext[0].substring(1)
		: fallback;
};

/**
 * Returns all known file extensions for given MIME type or undefined if
 * unknown.
 *
 * @param mime
 */
export const extensionsForType = (mime: string) => {
	const group = __group(mime);
	const ext = group ? __ext(group) : undefined;
	return ext
		? ext.map((x) => (x[0] === "*" ? x.substring(1) : x))
		: undefined;
};

/**
 * Returns true if the given MIME type can be compressed (or served using
 * gzip/brotli encoding).
 *
 * @remarks
 * A negative answer here only means that serving data with this MIME type does
 * usually _not_ benefit from additional compression, because the data already
 * is compressed.
 *
 * Note: Information here is included as is. Some of these judgements in the
 * original mime-db project (or their sources of information) are
 * questionable...
 *
 * @param mime
 */
export const isCompressible = (mime: string) => !!(__group(mime)?.[0] === "1");

export * from "./presets.js";
