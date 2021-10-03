import type { Nullable } from "@thi.ng/api";
import { timedResult } from "@thi.ng/bench/timed";
import { downloadWithMime } from "@thi.ng/dl-asset/raw";
import { DOWNLOAD } from "@thi.ng/hiccup-carbon-icons/download";
import { withSize } from "@thi.ng/hiccup-carbon-icons/with-size";
import { div } from "@thi.ng/hiccup-html/blocks";
import { textArea } from "@thi.ng/hiccup-html/forms";
import { anchor } from "@thi.ng/hiccup-html/inline";
import { h1, main } from "@thi.ng/hiccup-html/sections";
import type { Language } from "@thi.ng/parse";
import { defContext } from "@thi.ng/parse/context";
import { defGrammar } from "@thi.ng/parse/grammar";
import { print } from "@thi.ng/parse/xform/print";
import {
    dynamicDropdown,
    staticDropdown,
} from "@thi.ng/rdom-components/dropdown";
import { editor } from "@thi.ng/rdom-components/editor";
import { iconButton } from "@thi.ng/rdom-components/icon-button";
import { tabs } from "@thi.ng/rdom-components/tabs";
import { $compile } from "@thi.ng/rdom/compile";
import { CloseMode } from "@thi.ng/rstream/api";
import { metaStream } from "@thi.ng/rstream/metastream";
import { reactive } from "@thi.ng/rstream/stream";
import { sync } from "@thi.ng/rstream/sync";
import { interpolate } from "@thi.ng/strings/interpolate";
import { base64Decode, base64Encode } from "@thi.ng/transducers-binary/base64";
import { filter } from "@thi.ng/transducers/filter";
import { map } from "@thi.ng/transducers/map";
import { pluck } from "@thi.ng/transducers/pluck";
import { range } from "@thi.ng/transducers/range";
// @ts-ignore
import { deserialize, serialize } from "@ygoe/msgpack";
import type { ParseResult, Status } from "./api";
import {
    BG_COLS,
    BUTTON_CLASSES,
    CODE_TEMPLATES,
    DEFAULT_GRAMMAR,
    DEFAULT_INPUTS,
    DEFAULT_RULE,
    DOC_URL,
    DROPDOWN_ATTRIBS,
    EDITOR_OPTS,
    LINK_CLASSES,
    PANEL_CLASSES,
    SRC_URL,
    TAB_CLASSES,
} from "./config";

// attempt to restore app state from URI hash fragment
// this uses a base64 & msgpack encoded version of the two editors
const parseState = ((): Nullable<string[]> => {
    try {
        return deserialize(base64Decode(location.hash.substr(1)));
    } catch (e) {}
})() || [DEFAULT_GRAMMAR, DEFAULT_RULE, ...DEFAULT_INPUTS];

// init reactive stream values from parsed state (or defaults) the
// `CloseMode` config is required only for the `srcInputs` and force the
// streams to remain active, even if there're no current subscribers...
// (usually a stream terminates when its last subscriber has unsubscribed)
const [srcGrammar, activeRule, ...srcInputs] = parseState.map((src) =>
    reactive(src, { closeOut: CloseMode.NEVER })
);
console.log(srcGrammar.deref());
console.log(srcInputs[0].deref());

// selected codegen template ID
const activeTpl = reactive("ts");
// select test input ID (used for tabbed editor component)
const inputID = reactive(0);

// meta stream (stream of streams) which will yield contents of
// currently selected test input textfield
const activeInput = inputID.subscribe(metaStream((id) => srcInputs[id]));

// stream transform attempting to compile grammar
const lang = srcGrammar.map(
    (src): Partial<{ lang: Language; error: Error }> => {
        try {
            return { lang: defGrammar(src) };
        } catch (e) {
            return { error: <Error>e };
        }
    }
);

// stream transform to extract parser rule IDs
const ruleIDs = lang.transform(
    filter((l) => !!l.lang),
    map((l: any) => [
        "Choose parser...",
        ...Object.keys(l.lang.rules).filter((x) => /^[a-z0-9._$-]+$/.test(x)),
    ])
);

const $result = (status: Status, body: string, time?: number): ParseResult => ({
    status,
    body,
    time,
});

// stream combinator attempting to parse test input and if successful
// traverse & prettyprint result AST
const result = sync({
    src: {
        lang,
        src: activeInput,
        rule: activeRule,
    },
}).map(({ lang, src, rule }): ParseResult => {
    // error if no valid grammar
    if (!lang.lang) return $result("err", lang.error!.message);
    const parser = lang.lang.rules[rule];
    if (!parser) return $result("err", `invalid or missing parser: ${rule}`);
    try {
        const ast: string[] = [];
        const ctx = defContext(src, { retain: true });
        // measure execution time of the parsing process
        const [res, time] = timedResult(() =>
            print(parser, (x) => ast.push(x))(ctx)
        );
        const body = ast.join("\n");
        return res
            ? ctx.done
                ? $result("ok", body, time)
                : $result(
                      "partial",
                      `partial match only (stopped @ ${ctx.state.l}:${ctx.state.c})...\n\n${body}`,
                      time
                  )
            : $result(
                  "fail",
                  `input parse failure (no match)...\n\n${body}`,
                  time
              );
    } catch (e) {
        return $result("err", `Parse error: ${e}`);
    }
});

// update URL hash fragment with the msgpack & base64 encoded version of
// the selected parser rule and contents of all editors
sync({
    src: { grammar: srcGrammar, rule: activeRule, _: activeInput },
}).subscribe({
    next({ grammar, rule }) {
        const hash = base64Encode(
            { safe: true },
            serialize([grammar, rule, ...srcInputs.map((i) => i.deref())])
        ).replace(/=/g, "");
        location.hash =
            hash.length < 0x10000 ? hash : "content-too-large-for-uri-hash";
    },
});

// derives CSS classes from parse result type
const formatStatus = (res: ParseResult) =>
    PANEL_CLASSES + " " + BG_COLS[res.status];

// formats parse duration value
const formatTime = (res: ParseResult) =>
    `parsed in: ${res.time != null ? ~~res.time + "ms" : "n/a"}`;

// takes a template ID and grammar src, generates source code and
// triggers file download
const downloadParser = (tplID: string, src: string) => {
    const { ext, code } = CODE_TEMPLATES[tplID];
    downloadWithMime(
        `parser.${ext}`,
        interpolate(
            code,
            location.href,
            new Date().toISOString(),
            src.trim().replace(/\\/g, "\\\\"),
            activeRule.deref()!
        ),
        { mime: "text/plain", utf8: true }
    );
};

// simple styled link component
const link = (href: string, label: string) =>
    anchor({ class: LINK_CLASSES, target: "_blank", href }, label);

// compile entire UI and mount in DOM
$compile(
    div(
        {},
        h1(".ma0.fw2", {}, "Let's make a parser... "),
        div(
            ".mb2",
            {},
            link(DOC_URL, "Documentation"),
            " / ",
            link(SRC_URL, "Source code")
        ),
        main(
            {},
            // grammar editor
            div(
                {},
                editor(srcGrammar, {
                    ...EDITOR_OPTS,
                    // override wrapper style for this editor
                    wrapper: { class: "relative mt4-l" },
                })
            ),
            // test input editor
            div(
                {},
                // tabbed content component (here to wrap multiple editors for
                // test inputs)
                tabs(inputID, {
                    // facctory function for single tab headings
                    head: (_, title, id, selected) =>
                        div(
                            TAB_CLASSES,
                            {
                                // the class attrib is defined as object of
                                // booleans here, where each key's value
                                // indicates if that class should be used or not
                                // the classes listed here will be merged with
                                // the `TAB_CLASSES` given above
                                class: {
                                    "bg-white black": selected,
                                    "bg-moon-gray gray": !selected,
                                },
                                // all tab headers should have an onclick
                                // handler (unless you want to disable selecting
                                // tabs in some cases)
                                onclick: () => inputID.next(id),
                            },
                            title
                        ),
                    // array of tab specs
                    // the `content` fn should return a `ComponentLike` data structure
                    // it's an async fn to support lazy & dynamic import() of tab contents
                    sections: [
                        ...map(
                            (i) => ({
                                title: `#${i + 1}`,
                                content: async () =>
                                    editor(srcInputs[i], EDITOR_OPTS),
                            }),
                            range(DEFAULT_INPUTS.length)
                        ),
                    ],
                })
            ),
            // AST output
            div(
                EDITOR_OPTS.wrapper,
                textArea({
                    class: result.map(formatStatus),
                    value: result.transform(pluck("body")),
                    disabled: true,
                    rows: 16,
                }),
                div(EDITOR_OPTS.cursor!.attribs, result.map(formatTime))
            ),
            // user controls
            div(
                ".w-100",
                {},
                // reactive dropdown of user defined parser rules
                dynamicDropdown(ruleIDs, activeRule, {
                    attribs: DROPDOWN_ATTRIBS,
                }),
                // static dropdown of code generator templates
                staticDropdown(Object.keys(CODE_TEMPLATES), activeTpl, {
                    attribs: DROPDOWN_ATTRIBS,
                    label: (id) => CODE_TEMPLATES[id].name,
                }),
                // download button
                iconButton({
                    attribs: {
                        class: BUTTON_CLASSES,
                        onclick: () =>
                            downloadParser(
                                activeTpl.deref()!,
                                srcGrammar.deref()!
                            ),
                    },
                    icon: withSize(DOWNLOAD, "12px"),
                    label: "Download parser",
                })
            )
        )
    )
).mount(document.body);
