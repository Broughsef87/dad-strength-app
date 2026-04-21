(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/production/dad-strength-app/node_modules/@stitches/core/dist/index.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createStitches",
    ()=>X,
    "createTheme",
    ()=>q,
    "css",
    ()=>_,
    "defaultThemeMap",
    ()=>i,
    "globalCss",
    ()=>K,
    "keyframes",
    ()=>Q
]);
var e, t = "colors", n = "sizes", r = "space", i = {
    gap: r,
    gridGap: r,
    columnGap: r,
    gridColumnGap: r,
    rowGap: r,
    gridRowGap: r,
    inset: r,
    insetBlock: r,
    insetBlockEnd: r,
    insetBlockStart: r,
    insetInline: r,
    insetInlineEnd: r,
    insetInlineStart: r,
    margin: r,
    marginTop: r,
    marginRight: r,
    marginBottom: r,
    marginLeft: r,
    marginBlock: r,
    marginBlockEnd: r,
    marginBlockStart: r,
    marginInline: r,
    marginInlineEnd: r,
    marginInlineStart: r,
    padding: r,
    paddingTop: r,
    paddingRight: r,
    paddingBottom: r,
    paddingLeft: r,
    paddingBlock: r,
    paddingBlockEnd: r,
    paddingBlockStart: r,
    paddingInline: r,
    paddingInlineEnd: r,
    paddingInlineStart: r,
    top: r,
    right: r,
    bottom: r,
    left: r,
    scrollMargin: r,
    scrollMarginTop: r,
    scrollMarginRight: r,
    scrollMarginBottom: r,
    scrollMarginLeft: r,
    scrollMarginX: r,
    scrollMarginY: r,
    scrollMarginBlock: r,
    scrollMarginBlockEnd: r,
    scrollMarginBlockStart: r,
    scrollMarginInline: r,
    scrollMarginInlineEnd: r,
    scrollMarginInlineStart: r,
    scrollPadding: r,
    scrollPaddingTop: r,
    scrollPaddingRight: r,
    scrollPaddingBottom: r,
    scrollPaddingLeft: r,
    scrollPaddingX: r,
    scrollPaddingY: r,
    scrollPaddingBlock: r,
    scrollPaddingBlockEnd: r,
    scrollPaddingBlockStart: r,
    scrollPaddingInline: r,
    scrollPaddingInlineEnd: r,
    scrollPaddingInlineStart: r,
    fontSize: "fontSizes",
    background: t,
    backgroundColor: t,
    backgroundImage: t,
    borderImage: t,
    border: t,
    borderBlock: t,
    borderBlockEnd: t,
    borderBlockStart: t,
    borderBottom: t,
    borderBottomColor: t,
    borderColor: t,
    borderInline: t,
    borderInlineEnd: t,
    borderInlineStart: t,
    borderLeft: t,
    borderLeftColor: t,
    borderRight: t,
    borderRightColor: t,
    borderTop: t,
    borderTopColor: t,
    caretColor: t,
    color: t,
    columnRuleColor: t,
    fill: t,
    outline: t,
    outlineColor: t,
    stroke: t,
    textDecorationColor: t,
    fontFamily: "fonts",
    fontWeight: "fontWeights",
    lineHeight: "lineHeights",
    letterSpacing: "letterSpacings",
    blockSize: n,
    minBlockSize: n,
    maxBlockSize: n,
    inlineSize: n,
    minInlineSize: n,
    maxInlineSize: n,
    width: n,
    minWidth: n,
    maxWidth: n,
    height: n,
    minHeight: n,
    maxHeight: n,
    flexBasis: n,
    gridTemplateColumns: n,
    gridTemplateRows: n,
    borderWidth: "borderWidths",
    borderTopWidth: "borderWidths",
    borderRightWidth: "borderWidths",
    borderBottomWidth: "borderWidths",
    borderLeftWidth: "borderWidths",
    borderStyle: "borderStyles",
    borderTopStyle: "borderStyles",
    borderRightStyle: "borderStyles",
    borderBottomStyle: "borderStyles",
    borderLeftStyle: "borderStyles",
    borderRadius: "radii",
    borderTopLeftRadius: "radii",
    borderTopRightRadius: "radii",
    borderBottomRightRadius: "radii",
    borderBottomLeftRadius: "radii",
    boxShadow: "shadows",
    textShadow: "shadows",
    transition: "transitions",
    zIndex: "zIndices"
}, o = (e, t)=>"function" == typeof t ? {
        "()": Function.prototype.toString.call(t)
    } : t, l = ()=>{
    const e = Object.create(null);
    return (t, n, ...r)=>{
        const i = ((e)=>JSON.stringify(e, o))(t);
        return i in e ? e[i] : e[i] = n(t, ...r);
    };
}, s = Symbol.for("sxs.internal"), a = (e, t)=>Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)), c = (e)=>{
    for(const t in e)return !0;
    return !1;
}, { hasOwnProperty: d } = Object.prototype, g = (e)=>e.includes("-") ? e : e.replace(/[A-Z]/g, (e)=>"-" + e.toLowerCase()), p = /\s+(?![^()]*\))/, u = (e)=>(t)=>e(..."string" == typeof t ? String(t).split(p) : [
            t
        ]), h = {
    appearance: (e)=>({
            WebkitAppearance: e,
            appearance: e
        }),
    backfaceVisibility: (e)=>({
            WebkitBackfaceVisibility: e,
            backfaceVisibility: e
        }),
    backdropFilter: (e)=>({
            WebkitBackdropFilter: e,
            backdropFilter: e
        }),
    backgroundClip: (e)=>({
            WebkitBackgroundClip: e,
            backgroundClip: e
        }),
    boxDecorationBreak: (e)=>({
            WebkitBoxDecorationBreak: e,
            boxDecorationBreak: e
        }),
    clipPath: (e)=>({
            WebkitClipPath: e,
            clipPath: e
        }),
    content: (e)=>({
            content: e.includes('"') || e.includes("'") || /^([A-Za-z]+\([^]*|[^]*-quote|inherit|initial|none|normal|revert|unset)$/.test(e) ? e : `"${e}"`
        }),
    hyphens: (e)=>({
            WebkitHyphens: e,
            hyphens: e
        }),
    maskImage: (e)=>({
            WebkitMaskImage: e,
            maskImage: e
        }),
    maskSize: (e)=>({
            WebkitMaskSize: e,
            maskSize: e
        }),
    tabSize: (e)=>({
            MozTabSize: e,
            tabSize: e
        }),
    textSizeAdjust: (e)=>({
            WebkitTextSizeAdjust: e,
            textSizeAdjust: e
        }),
    userSelect: (e)=>({
            WebkitUserSelect: e,
            userSelect: e
        }),
    marginBlock: u((e, t)=>({
            marginBlockStart: e,
            marginBlockEnd: t || e
        })),
    marginInline: u((e, t)=>({
            marginInlineStart: e,
            marginInlineEnd: t || e
        })),
    maxSize: u((e, t)=>({
            maxBlockSize: e,
            maxInlineSize: t || e
        })),
    minSize: u((e, t)=>({
            minBlockSize: e,
            minInlineSize: t || e
        })),
    paddingBlock: u((e, t)=>({
            paddingBlockStart: e,
            paddingBlockEnd: t || e
        })),
    paddingInline: u((e, t)=>({
            paddingInlineStart: e,
            paddingInlineEnd: t || e
        }))
}, f = /([\d.]+)([^]*)/, m = (e, t)=>e.length ? e.reduce((e, n)=>(e.push(...t.map((e)=>e.includes("&") ? e.replace(/&/g, /[ +>|~]/.test(n) && /&.*&/.test(e) ? `:is(${n})` : n) : n + " " + e)), e), []) : t, b = (e, t)=>e in S && "string" == typeof t ? t.replace(/^((?:[^]*[^\w-])?)(fit-content|stretch)((?:[^\w-][^]*)?)$/, (t, n, r, i)=>n + ("stretch" === r ? `-moz-available${i};${g(e)}:${n}-webkit-fill-available` : `-moz-fit-content${i};${g(e)}:${n}fit-content`) + i) : String(t), S = {
    blockSize: 1,
    height: 1,
    inlineSize: 1,
    maxBlockSize: 1,
    maxHeight: 1,
    maxInlineSize: 1,
    maxWidth: 1,
    minBlockSize: 1,
    minHeight: 1,
    minInlineSize: 1,
    minWidth: 1,
    width: 1
}, k = (e)=>e ? e + "-" : "", y = (e, t, n)=>e.replace(/([+-])?((?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?)?(\$|--)([$\w-]+)/g, (e, r, i, o, l)=>"$" == o == !!i ? e : (r || "--" == o ? "calc(" : "") + "var(--" + ("$" === o ? k(t) + (l.includes("$") ? "" : k(n)) + l.replace(/\$/g, "-") : l) + ")" + (r || "--" == o ? "*" + (r || "") + (i || "1") + ")" : "")), B = /\s*,\s*(?![^()]*\))/, $ = Object.prototype.toString, x = (e, t, n, r, i)=>{
    let o, l, s;
    const a = (e, t, n)=>{
        let c, d;
        const p = (e)=>{
            for(c in e){
                const x = 64 === c.charCodeAt(0), z = x && Array.isArray(e[c]) ? e[c] : [
                    e[c]
                ];
                for (d of z){
                    const e = /[A-Z]/.test(S = c) ? S : S.replace(/-[^]/g, (e)=>e[1].toUpperCase()), z = "object" == typeof d && d && d.toString === $ && (!r.utils[e] || !t.length);
                    if (e in r.utils && !z) {
                        const t = r.utils[e];
                        if (t !== l) {
                            l = t, p(t(d)), l = null;
                            continue;
                        }
                    } else if (e in h) {
                        const t = h[e];
                        if (t !== s) {
                            s = t, p(t(d)), s = null;
                            continue;
                        }
                    }
                    if (x && (u = c.slice(1) in r.media ? "@media " + r.media[c.slice(1)] : c, c = u.replace(/\(\s*([\w-]+)\s*(=|<|<=|>|>=)\s*([\w-]+)\s*(?:(<|<=|>|>=)\s*([\w-]+)\s*)?\)/g, (e, t, n, r, i, o)=>{
                        const l = f.test(t), s = .0625 * (l ? -1 : 1), [a, c] = l ? [
                            r,
                            t
                        ] : [
                            t,
                            r
                        ];
                        return "(" + ("=" === n[0] ? "" : ">" === n[0] === l ? "max-" : "min-") + a + ":" + ("=" !== n[0] && 1 === n.length ? c.replace(f, (e, t, r)=>Number(t) + s * (">" === n ? 1 : -1) + r) : c) + (i ? ") and (" + (">" === i[0] ? "min-" : "max-") + a + ":" + (1 === i.length ? o.replace(f, (e, t, n)=>Number(t) + s * (">" === i ? -1 : 1) + n) : o) : "") + ")";
                    })), z) {
                        const e = x ? n.concat(c) : [
                            ...n
                        ], r = x ? [
                            ...t
                        ] : m(t, c.split(B));
                        void 0 !== o && i(I(...o)), o = void 0, a(d, r, e);
                    } else void 0 === o && (o = [
                        [],
                        t,
                        n
                    ]), c = x || 36 !== c.charCodeAt(0) ? c : `--${k(r.prefix)}${c.slice(1).replace(/\$/g, "-")}`, d = z ? d : "number" == typeof d ? d && e in R ? String(d) + "px" : String(d) : y(b(e, null == d ? "" : d), r.prefix, r.themeMap[e]), o[0].push(`${x ? `${c} ` : `${g(c)}:`}${d}`);
                }
            }
            var u, S;
        };
        p(e), void 0 !== o && i(I(...o)), o = void 0;
    };
    a(e, t, n);
}, I = (e, t, n)=>`${n.map((e)=>`${e}{`).join("")}${t.length ? `${t.join(",")}{` : ""}${e.join(";")}${t.length ? "}" : ""}${Array(n.length ? n.length + 1 : 0).join("}")}`, R = {
    animationDelay: 1,
    animationDuration: 1,
    backgroundSize: 1,
    blockSize: 1,
    border: 1,
    borderBlock: 1,
    borderBlockEnd: 1,
    borderBlockEndWidth: 1,
    borderBlockStart: 1,
    borderBlockStartWidth: 1,
    borderBlockWidth: 1,
    borderBottom: 1,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
    borderBottomWidth: 1,
    borderEndEndRadius: 1,
    borderEndStartRadius: 1,
    borderInlineEnd: 1,
    borderInlineEndWidth: 1,
    borderInlineStart: 1,
    borderInlineStartWidth: 1,
    borderInlineWidth: 1,
    borderLeft: 1,
    borderLeftWidth: 1,
    borderRadius: 1,
    borderRight: 1,
    borderRightWidth: 1,
    borderSpacing: 1,
    borderStartEndRadius: 1,
    borderStartStartRadius: 1,
    borderTop: 1,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    borderTopWidth: 1,
    borderWidth: 1,
    bottom: 1,
    columnGap: 1,
    columnRule: 1,
    columnRuleWidth: 1,
    columnWidth: 1,
    containIntrinsicSize: 1,
    flexBasis: 1,
    fontSize: 1,
    gap: 1,
    gridAutoColumns: 1,
    gridAutoRows: 1,
    gridTemplateColumns: 1,
    gridTemplateRows: 1,
    height: 1,
    inlineSize: 1,
    inset: 1,
    insetBlock: 1,
    insetBlockEnd: 1,
    insetBlockStart: 1,
    insetInline: 1,
    insetInlineEnd: 1,
    insetInlineStart: 1,
    left: 1,
    letterSpacing: 1,
    margin: 1,
    marginBlock: 1,
    marginBlockEnd: 1,
    marginBlockStart: 1,
    marginBottom: 1,
    marginInline: 1,
    marginInlineEnd: 1,
    marginInlineStart: 1,
    marginLeft: 1,
    marginRight: 1,
    marginTop: 1,
    maxBlockSize: 1,
    maxHeight: 1,
    maxInlineSize: 1,
    maxWidth: 1,
    minBlockSize: 1,
    minHeight: 1,
    minInlineSize: 1,
    minWidth: 1,
    offsetDistance: 1,
    offsetRotate: 1,
    outline: 1,
    outlineOffset: 1,
    outlineWidth: 1,
    overflowClipMargin: 1,
    padding: 1,
    paddingBlock: 1,
    paddingBlockEnd: 1,
    paddingBlockStart: 1,
    paddingBottom: 1,
    paddingInline: 1,
    paddingInlineEnd: 1,
    paddingInlineStart: 1,
    paddingLeft: 1,
    paddingRight: 1,
    paddingTop: 1,
    perspective: 1,
    right: 1,
    rowGap: 1,
    scrollMargin: 1,
    scrollMarginBlock: 1,
    scrollMarginBlockEnd: 1,
    scrollMarginBlockStart: 1,
    scrollMarginBottom: 1,
    scrollMarginInline: 1,
    scrollMarginInlineEnd: 1,
    scrollMarginInlineStart: 1,
    scrollMarginLeft: 1,
    scrollMarginRight: 1,
    scrollMarginTop: 1,
    scrollPadding: 1,
    scrollPaddingBlock: 1,
    scrollPaddingBlockEnd: 1,
    scrollPaddingBlockStart: 1,
    scrollPaddingBottom: 1,
    scrollPaddingInline: 1,
    scrollPaddingInlineEnd: 1,
    scrollPaddingInlineStart: 1,
    scrollPaddingLeft: 1,
    scrollPaddingRight: 1,
    scrollPaddingTop: 1,
    shapeMargin: 1,
    textDecoration: 1,
    textDecorationThickness: 1,
    textIndent: 1,
    textUnderlineOffset: 1,
    top: 1,
    transitionDelay: 1,
    transitionDuration: 1,
    verticalAlign: 1,
    width: 1,
    wordSpacing: 1
}, z = (e)=>String.fromCharCode(e + (e > 25 ? 39 : 97)), W = (e)=>((e)=>{
        let t, n = "";
        for(t = Math.abs(e); t > 52; t = t / 52 | 0)n = z(t % 52) + n;
        return z(t % 52) + n;
    })(((e, t)=>{
        let n = t.length;
        for(; n;)e = 33 * e ^ t.charCodeAt(--n);
        return e;
    })(5381, JSON.stringify(e)) >>> 0), j = [
    "themed",
    "global",
    "styled",
    "onevar",
    "resonevar",
    "allvar",
    "inline"
], E = (e)=>{
    if (e.href && !e.href.startsWith(location.origin)) return !1;
    try {
        return !!e.cssRules;
    } catch (e) {
        return !1;
    }
}, T = (e)=>{
    let t;
    const n = ()=>{
        const { cssRules: e } = t.sheet;
        return [].map.call(e, (n, r)=>{
            const { cssText: i } = n;
            let o = "";
            if (i.startsWith("--sxs")) return "";
            if (e[r - 1] && (o = e[r - 1].cssText).startsWith("--sxs")) {
                if (!n.cssRules.length) return "";
                for(const e in t.rules)if (t.rules[e].group === n) return `--sxs{--sxs:${[
                    ...t.rules[e].cache
                ].join(" ")}}${i}`;
                return n.cssRules.length ? `${o}${i}` : "";
            }
            return i;
        }).join("");
    }, r = ()=>{
        if (t) {
            const { rules: e, sheet: n } = t;
            if (!n.deleteRule) {
                for(; 3 === Object(Object(n.cssRules)[0]).type;)n.cssRules.splice(0, 1);
                n.cssRules = [];
            }
            for(const t in e)delete e[t];
        }
        const i = Object(e).styleSheets || [];
        for (const e of i)if (E(e)) {
            for(let i = 0, o = e.cssRules; o[i]; ++i){
                const l = Object(o[i]);
                if (1 !== l.type) continue;
                const s = Object(o[i + 1]);
                if (4 !== s.type) continue;
                ++i;
                const { cssText: a } = l;
                if (!a.startsWith("--sxs")) continue;
                const c = a.slice(14, -3).trim().split(/\s+/), d = j[c[0]];
                d && (t || (t = {
                    sheet: e,
                    reset: r,
                    rules: {},
                    toString: n
                }), t.rules[d] = {
                    group: s,
                    index: i,
                    cache: new Set(c)
                });
            }
            if (t) break;
        }
        if (!t) {
            const i = (e, t)=>({
                    type: t,
                    cssRules: [],
                    insertRule (e, t) {
                        this.cssRules.splice(t, 0, i(e, {
                            import: 3,
                            undefined: 1
                        }[(e.toLowerCase().match(/^@([a-z]+)/) || [])[1]] || 4));
                    },
                    get cssText () {
                        return "@media{}" === e ? `@media{${[].map.call(this.cssRules, (e)=>e.cssText).join("")}}` : e;
                    }
                });
            t = {
                sheet: e ? (e.head || e).appendChild(document.createElement("style")).sheet : i("", "text/css"),
                rules: {},
                reset: r,
                toString: n
            };
        }
        const { sheet: o, rules: l } = t;
        for(let e = j.length - 1; e >= 0; --e){
            const t = j[e];
            if (!l[t]) {
                const n = j[e + 1], r = l[n] ? l[n].index : o.cssRules.length;
                o.insertRule("@media{}", r), o.insertRule(`--sxs{--sxs:${e}}`, r), l[t] = {
                    group: o.cssRules[r + 1],
                    index: r,
                    cache: new Set([
                        e
                    ])
                };
            }
            v(l[t]);
        }
    };
    return r(), t;
}, v = (e)=>{
    const t = e.group;
    let n = t.cssRules.length;
    e.apply = (e)=>{
        try {
            t.insertRule(e, n), ++n;
        } catch (e) {}
    };
}, M = Symbol(), w = l(), C = (e, t)=>w(e, ()=>(...n)=>{
            let r = {
                type: null,
                composers: new Set
            };
            for (const t of n)if (null != t) if (t[s]) {
                null == r.type && (r.type = t[s].type);
                for (const e of t[s].composers)r.composers.add(e);
            } else t.constructor !== Object || t.$$typeof ? null == r.type && (r.type = t) : r.composers.add(P(t, e));
            return null == r.type && (r.type = "span"), r.composers.size || r.composers.add([
                "PJLV",
                {},
                [],
                [],
                {},
                []
            ]), L(e, r, t);
        }), P = ({ variants: e, compoundVariants: t, defaultVariants: n, ...r }, i)=>{
    const o = `${k(i.prefix)}c-${W(r)}`, l = [], s = [], a = Object.create(null), g = [];
    for(const e in n)a[e] = String(n[e]);
    if ("object" == typeof e && e) for(const t in e){
        p = a, u = t, d.call(p, u) || (a[t] = "undefined");
        const n = e[t];
        for(const e in n){
            const r = {
                [t]: String(e)
            };
            "undefined" === String(e) && g.push(t);
            const i = n[e], o = [
                r,
                i,
                !c(i)
            ];
            l.push(o);
        }
    }
    var p, u;
    if ("object" == typeof t && t) for (const e of t){
        let { css: t, ...n } = e;
        t = "object" == typeof t && t || {};
        for(const e in n)n[e] = String(n[e]);
        const r = [
            n,
            t,
            !c(t)
        ];
        s.push(r);
    }
    return [
        o,
        r,
        l,
        s,
        a,
        g
    ];
}, L = (e, t, n)=>{
    const [r, i, o, l] = O(t.composers), c = "function" == typeof t.type || t.type.$$typeof ? ((e)=>{
        function t() {
            for(let n = 0; n < t[M].length; n++){
                const [r, i] = t[M][n];
                e.rules[r].apply(i);
            }
            return t[M] = [], null;
        }
        return t[M] = [], t.rules = {}, j.forEach((e)=>t.rules[e] = {
                apply: (n)=>t[M].push([
                        e,
                        n
                    ])
            }), t;
    })(n) : null, d = (c || n).rules, g = `.${r}${i.length > 1 ? `:where(.${i.slice(1).join(".")})` : ""}`, p = (s)=>{
        s = "object" == typeof s && s || D;
        const { css: a, ...p } = s, u = {};
        for(const e in o)if (delete p[e], e in s) {
            let t = s[e];
            "object" == typeof t && t ? u[e] = {
                "@initial": o[e],
                ...t
            } : (t = String(t), u[e] = "undefined" !== t || l.has(e) ? t : o[e]);
        } else u[e] = o[e];
        const h = new Set([
            ...i
        ]);
        for (const [r, i, o, l] of t.composers){
            n.rules.styled.cache.has(r) || (n.rules.styled.cache.add(r), x(i, [
                `.${r}`
            ], [], e, (e)=>{
                d.styled.apply(e);
            }));
            const t = A(o, u, e.media), s = A(l, u, e.media, !0);
            for (const i of t)if (void 0 !== i) for (const [t, o, l] of i){
                const i = `${r}-${W(o)}-${t}`;
                h.add(i);
                const s = (l ? n.rules.resonevar : n.rules.onevar).cache, a = l ? d.resonevar : d.onevar;
                s.has(i) || (s.add(i), x(o, [
                    `.${i}`
                ], [], e, (e)=>{
                    a.apply(e);
                }));
            }
            for (const t of s)if (void 0 !== t) for (const [i, o] of t){
                const t = `${r}-${W(o)}-${i}`;
                h.add(t), n.rules.allvar.cache.has(t) || (n.rules.allvar.cache.add(t), x(o, [
                    `.${t}`
                ], [], e, (e)=>{
                    d.allvar.apply(e);
                }));
            }
        }
        if ("object" == typeof a && a) {
            const t = `${r}-i${W(a)}-css`;
            h.add(t), n.rules.inline.cache.has(t) || (n.rules.inline.cache.add(t), x(a, [
                `.${t}`
            ], [], e, (e)=>{
                d.inline.apply(e);
            }));
        }
        for (const e of String(s.className || "").trim().split(/\s+/))e && h.add(e);
        const f = p.className = [
            ...h
        ].join(" ");
        return {
            type: t.type,
            className: f,
            selector: g,
            props: p,
            toString: ()=>f,
            deferredInjector: c
        };
    };
    return a(p, {
        className: r,
        selector: g,
        [s]: t,
        toString: ()=>(n.rules.styled.cache.has(r) || p(), r)
    });
}, O = (e)=>{
    let t = "";
    const n = [], r = {}, i = [];
    for (const [o, , , , l, s] of e){
        "" === t && (t = o), n.push(o), i.push(...s);
        for(const e in l){
            const t = l[e];
            (void 0 === r[e] || "undefined" !== t || s.includes(t)) && (r[e] = t);
        }
    }
    return [
        t,
        n,
        r,
        new Set(i)
    ];
}, A = (e, t, n, r)=>{
    const i = [];
    e: for (let [o, l, s] of e){
        if (s) continue;
        let e, a = 0, c = !1;
        for(e in o){
            const r = o[e];
            let i = t[e];
            if (i !== r) {
                if ("object" != typeof i || !i) continue e;
                {
                    let e, t, o = 0;
                    for(const l in i){
                        if (r === String(i[l])) {
                            if ("@initial" !== l) {
                                const e = l.slice(1);
                                (t = t || []).push(e in n ? n[e] : l.replace(/^@media ?/, "")), c = !0;
                            }
                            a += o, e = !0;
                        }
                        ++o;
                    }
                    if (t && t.length && (l = {
                        ["@media " + t.join(", ")]: l
                    }), !e) continue e;
                }
            }
        }
        (i[a] = i[a] || []).push([
            r ? "cv" : `${e}-${o[e]}`,
            l,
            c
        ]);
    }
    return i;
}, D = {}, H = l(), N = (e, t)=>H(e, ()=>(...n)=>{
            const r = ()=>{
                for (let r of n){
                    r = "object" == typeof r && r || {};
                    let n = W(r);
                    if (!t.rules.global.cache.has(n)) {
                        if (t.rules.global.cache.add(n), "@import" in r) {
                            let e = [].indexOf.call(t.sheet.cssRules, t.rules.themed.group) - 1;
                            for (let n of [].concat(r["@import"]))n = n.includes('"') || n.includes("'") ? n : `"${n}"`, t.sheet.insertRule(`@import ${n};`, e++);
                            delete r["@import"];
                        }
                        x(r, [], [], e, (e)=>{
                            t.rules.global.apply(e);
                        });
                    }
                }
                return "";
            };
            return a(r, {
                toString: r
            });
        }), V = l(), G = (e, t)=>V(e, ()=>(n)=>{
            const r = `${k(e.prefix)}k-${W(n)}`, i = ()=>{
                if (!t.rules.global.cache.has(r)) {
                    t.rules.global.cache.add(r);
                    const i = [];
                    x(n, [], [], e, (e)=>i.push(e));
                    const o = `@keyframes ${r}{${i.join("")}}`;
                    t.rules.global.apply(o);
                }
                return r;
            };
            return a(i, {
                get name () {
                    return i();
                },
                toString: i
            });
        }), F = class {
    constructor(e, t, n, r){
        this.token = null == e ? "" : String(e), this.value = null == t ? "" : String(t), this.scale = null == n ? "" : String(n), this.prefix = null == r ? "" : String(r);
    }
    get computedValue() {
        return "var(" + this.variable + ")";
    }
    get variable() {
        return "--" + k(this.prefix) + k(this.scale) + this.token;
    }
    toString() {
        return this.computedValue;
    }
}, J = l(), U = (e, t)=>J(e, ()=>(n, r)=>{
            r = "object" == typeof n && n || Object(r);
            const i = `.${n = (n = "string" == typeof n ? n : "") || `${k(e.prefix)}t-${W(r)}`}`, o = {}, l = [];
            for(const t in r){
                o[t] = {};
                for(const n in r[t]){
                    const i = `--${k(e.prefix)}${t}-${n}`, s = y(String(r[t][n]), e.prefix, t);
                    o[t][n] = new F(n, s, t, e.prefix), l.push(`${i}:${s}`);
                }
            }
            const s = ()=>{
                if (l.length && !t.rules.themed.cache.has(n)) {
                    t.rules.themed.cache.add(n);
                    const i = `${r === e.theme ? ":root," : ""}.${n}{${l.join(";")}}`;
                    t.rules.themed.apply(i);
                }
                return n;
            };
            return {
                ...o,
                get className () {
                    return s();
                },
                selector: i,
                toString: s
            };
        }), Z = l(), X = (e)=>{
    let t = !1;
    const n = Z(e, (e)=>{
        t = !0;
        const n = "prefix" in (e = "object" == typeof e && e || {}) ? String(e.prefix) : "", r = "object" == typeof e.media && e.media || {}, o = "object" == typeof e.root ? e.root || null : globalThis.document || null, l = "object" == typeof e.theme && e.theme || {}, s = {
            prefix: n,
            media: r,
            theme: l,
            themeMap: "object" == typeof e.themeMap && e.themeMap || {
                ...i
            },
            utils: "object" == typeof e.utils && e.utils || {}
        }, a = T(o), c = {
            css: C(s, a),
            globalCss: N(s, a),
            keyframes: G(s, a),
            createTheme: U(s, a),
            reset () {
                a.reset(), c.theme.toString();
            },
            theme: {},
            sheet: a,
            config: s,
            prefix: n,
            getCssText: a.toString,
            toString: a.toString
        };
        return String(c.theme = c.createTheme(l)), c;
    });
    return t || n.reset(), n;
}, Y = ()=>e || (e = X()), q = (...e)=>Y().createTheme(...e), K = (...e)=>Y().globalCss(...e), Q = (...e)=>Y().keyframes(...e), _ = (...e)=>Y().css(...e);
;
 //# sourceMappingUrl=index.map
}),
"[project]/production/dad-strength-app/node_modules/@supabase/auth-ui-shared/dist/index.mjs [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CLASS_NAMES",
    ()=>CLASS_NAMES,
    "PREPENDED_CLASS_NAMES",
    ()=>PREPENDED_CLASS_NAMES,
    "SocialLayouts",
    ()=>SocialLayouts,
    "ThemeMinimal",
    ()=>ThemeMinimal,
    "ThemeSupa",
    ()=>ThemeSupa,
    "VIEWS",
    ()=>VIEWS,
    "darkThemes",
    ()=>darkThemes,
    "en",
    ()=>en_default,
    "generateClassNames",
    ()=>generateClassNames,
    "merge",
    ()=>merge,
    "minimal",
    ()=>minimal,
    "supabase",
    ()=>supabase,
    "template",
    ()=>template
]);
// src/theming/defaultThemes.ts
var ThemeSupa = {
    default: {
        colors: {
            brand: "hsl(153 60.0% 53.0%)",
            brandAccent: "hsl(154 54.8% 45.1%)",
            brandButtonText: "white",
            defaultButtonBackground: "white",
            defaultButtonBackgroundHover: "#eaeaea",
            defaultButtonBorder: "lightgray",
            defaultButtonText: "gray",
            dividerBackground: "#eaeaea",
            inputBackground: "transparent",
            inputBorder: "lightgray",
            inputBorderHover: "gray",
            inputBorderFocus: "gray",
            inputText: "black",
            inputLabelText: "gray",
            inputPlaceholder: "darkgray",
            messageText: "#2b805a",
            messageBackground: "#e7fcf1",
            messageBorder: "#d0f3e1",
            messageTextDanger: "#ff6369",
            messageBackgroundDanger: "#fff8f8",
            messageBorderDanger: "#822025",
            anchorTextColor: "gray",
            anchorTextHoverColor: "darkgray"
        },
        space: {
            spaceSmall: "4px",
            spaceMedium: "8px",
            spaceLarge: "16px",
            labelBottomMargin: "8px",
            anchorBottomMargin: "4px",
            emailInputSpacing: "4px",
            socialAuthSpacing: "4px",
            buttonPadding: "10px 15px",
            inputPadding: "10px 15px"
        },
        fontSizes: {
            baseBodySize: "13px",
            baseInputSize: "14px",
            baseLabelSize: "14px",
            baseButtonSize: "14px"
        },
        fonts: {
            bodyFontFamily: `ui-sans-serif, sans-serif`,
            buttonFontFamily: `ui-sans-serif, sans-serif`,
            inputFontFamily: `ui-sans-serif, sans-serif`,
            labelFontFamily: `ui-sans-serif, sans-serif`
        },
        // fontWeights: {},
        // lineHeights: {},
        // letterSpacings: {},
        // sizes: {},
        borderWidths: {
            buttonBorderWidth: "1px",
            inputBorderWidth: "1px"
        },
        // borderStyles: {},
        radii: {
            borderRadiusButton: "4px",
            buttonBorderRadius: "4px",
            inputBorderRadius: "4px"
        }
    },
    dark: {
        colors: {
            brandButtonText: "white",
            defaultButtonBackground: "#2e2e2e",
            defaultButtonBackgroundHover: "#3e3e3e",
            defaultButtonBorder: "#3e3e3e",
            defaultButtonText: "white",
            dividerBackground: "#2e2e2e",
            inputBackground: "#1e1e1e",
            inputBorder: "#3e3e3e",
            inputBorderHover: "gray",
            inputBorderFocus: "gray",
            inputText: "white",
            inputPlaceholder: "darkgray",
            messageText: "#85e0b7",
            messageBackground: "#072719",
            messageBorder: "#2b805a",
            messageBackgroundDanger: "#1f1315"
        }
    }
};
var ThemeMinimal = {
    default: {
        colors: {
            brand: "black",
            brandAccent: "#333333",
            brandButtonText: "white",
            defaultButtonBackground: "white",
            defaultButtonBorder: "lightgray",
            defaultButtonText: "gray",
            dividerBackground: "#eaeaea",
            inputBackground: "transparent",
            inputBorder: "lightgray",
            inputText: "black",
            inputPlaceholder: "darkgray",
            messageText: "#2b805a",
            messageBackground: "#e7fcf1",
            messageBorder: "#d0f3e1",
            messageTextDanger: "#ff6369",
            messageBackgroundDanger: "#fff8f8",
            messageBorderDanger: "#822025"
        },
        space: {
            spaceSmall: "4px",
            spaceMedium: "8px",
            spaceLarge: "16px"
        },
        fontSizes: {
            baseInputSize: "14px",
            baseLabelSize: "12px"
        },
        fonts: {
            bodyFontFamily: "",
            inputFontFamily: "",
            buttonFontFamily: "",
            labelFontFamily: ""
        },
        // fontWeights: {},
        // lineHeights: {},
        // letterSpacings: {},
        // sizes: {},
        borderWidths: {},
        // borderStyles: {},
        radii: {}
    },
    dark: {
        colors: {
            brand: "white",
            brandAccent: "#afafaf",
            brandButtonText: "black",
            defaultButtonBackground: "#080808",
            defaultButtonBorder: "black",
            defaultButtonText: "white",
            dividerBackground: "black",
            inputBackground: "transparent",
            inputBorder: "gray",
            inputText: "black",
            inputPlaceholder: "darkgray",
            messageText: "#85e0b7",
            messageBackground: "#072719",
            messageBorder: "#2b805a",
            messageBackgroundDanger: "#1f1315"
        }
    }
};
// src/theming/Themes.ts
var supabase = {
    colors: {
        brand: "hsl(153 60.0% 53.0%)",
        brandAccent: "hsl(154 54.8% 45.1%)",
        brandButtonText: "white",
        defaultButtonBackground: "white",
        defaultButtonBackgroundHover: "#eaeaea",
        defaultButtonBorder: "lightgray",
        defaultButtonText: "gray",
        dividerBackground: "#eaeaea",
        inputBackground: "transparent",
        inputBorder: "lightgray",
        inputBorderHover: "gray",
        inputBorderFocus: "gray",
        inputText: "black",
        inputLabelText: "gray",
        inputPlaceholder: "darkgray",
        messageText: "gray",
        messageTextDanger: "red",
        anchorTextColor: "gray",
        anchorTextHoverColor: "darkgray"
    },
    space: {
        spaceSmall: "4px",
        spaceMedium: "8px",
        spaceLarge: "16px",
        labelBottomMargin: "8px",
        anchorBottomMargin: "4px",
        emailInputSpacing: "4px",
        socialAuthSpacing: "4px",
        buttonPadding: "10px 15px",
        inputPadding: "10px 15px"
    },
    fontSizes: {
        baseBodySize: "13px",
        baseInputSize: "14px",
        baseLabelSize: "14px",
        baseButtonSize: "14px"
    },
    fonts: {
        bodyFontFamily: `ui-sans-serif, sans-serif`,
        buttonFontFamily: `ui-sans-serif, sans-serif`,
        inputFontFamily: `ui-sans-serif, sans-serif`,
        labelFontFamily: `ui-sans-serif, sans-serif`
    },
    // fontWeights: {},
    // lineHeights: {},
    // letterSpacings: {},
    // sizes: {},
    borderWidths: {
        buttonBorderWidth: "1px",
        inputBorderWidth: "1px"
    },
    // borderStyles: {},
    radii: {
        borderRadiusButton: "4px",
        buttonBorderRadius: "4px",
        inputBorderRadius: "4px"
    }
};
var defaultDarkTheme = {
    colors: {
        brandButtonText: "white",
        defaultButtonBackground: "#2e2e2e",
        defaultButtonBackgroundHover: "#3e3e3e",
        defaultButtonBorder: "#3e3e3e",
        defaultButtonText: "white",
        dividerBackground: "#2e2e2e",
        inputBackground: "#1e1e1e",
        inputBorder: "#3e3e3e",
        inputBorderHover: "gray",
        inputBorderFocus: "gray",
        inputText: "white",
        inputPlaceholder: "darkgray"
    }
};
var minimal = {
    colors: {
        brand: "black",
        brandAccent: "#333333",
        brandButtonText: "white",
        defaultButtonBackground: "white",
        defaultButtonBorder: "lightgray",
        defaultButtonText: "gray",
        dividerBackground: "#eaeaea",
        inputBackground: "transparent",
        inputBorder: "lightgray",
        inputText: "black",
        inputPlaceholder: "darkgray"
    },
    space: {
        spaceSmall: "4px",
        spaceMedium: "8px",
        spaceLarge: "16px"
    },
    fontSizes: {
        baseInputSize: "14px",
        baseLabelSize: "12px"
    },
    fonts: {
        bodyFontFamily: "",
        inputFontFamily: "",
        buttonFontFamily: "",
        labelFontFamily: ""
    },
    // fontWeights: {},
    // lineHeights: {},
    // letterSpacings: {},
    // sizes: {},
    borderWidths: {},
    // borderStyles: {},
    radii: {}
};
var minimalDark = {
    colors: {
        brand: "white",
        brandAccent: "#afafaf",
        brandButtonText: "black",
        defaultButtonBackground: "#080808",
        defaultButtonBorder: "black",
        defaultButtonText: "white",
        dividerBackground: "black",
        inputBackground: "transparent",
        inputBorder: "gray",
        inputText: "black",
        inputPlaceholder: "darkgray"
    }
};
var darkThemes = {
    supabase: defaultDarkTheme,
    minimal: minimalDark
};
// src/constants.ts
var VIEWS = {
    SIGN_IN: "sign_in",
    SIGN_UP: "sign_up",
    FORGOTTEN_PASSWORD: "forgotten_password",
    MAGIC_LINK: "magic_link",
    UPDATE_PASSWORD: "update_password",
    VERIFY_OTP: "verify_otp"
};
var PREPENDED_CLASS_NAMES = "supabase-auth-ui";
var CLASS_NAMES = {
    // interfaces
    ROOT: "root",
    SIGN_IN: VIEWS.SIGN_IN,
    SIGN_UP: VIEWS.SIGN_UP,
    FORGOTTEN_PASSWORD: VIEWS.FORGOTTEN_PASSWORD,
    MAGIC_LINK: VIEWS.MAGIC_LINK,
    UPDATE_PASSWORD: VIEWS.UPDATE_PASSWORD,
    // ui
    anchor: "ui-anchor",
    button: "ui-button",
    container: "ui-container",
    divider: "ui-divider",
    input: "ui-input",
    label: "ui-label",
    loader: "ui-loader",
    message: "ui-message"
};
// src/theming/utils.ts
function generateClassNames(classNameKey, defaultStyles, appearance) {
    var _a, _b;
    const classNames = [];
    const className = CLASS_NAMES[classNameKey];
    classNames.push((appearance == null ? void 0 : appearance.prependedClassName) ? (appearance == null ? void 0 : appearance.prependedClassName) + "_" + className : PREPENDED_CLASS_NAMES + "_" + className);
    if ((_a = appearance == null ? void 0 : appearance.className) == null ? void 0 : _a[classNameKey]) {
        classNames.push((_b = appearance == null ? void 0 : appearance.className) == null ? void 0 : _b[classNameKey]);
    }
    if ((appearance == null ? void 0 : appearance.extend) === void 0 || (appearance == null ? void 0 : appearance.extend) === true) {
        classNames.push(defaultStyles);
    }
    return classNames;
}
// src/types.ts
var SocialLayouts = /* @__PURE__ */ ((SocialLayouts2)=>{
    SocialLayouts2[SocialLayouts2["horizontal"] = 0] = "horizontal";
    SocialLayouts2[SocialLayouts2["vertical"] = 1] = "vertical";
    return SocialLayouts2;
})(SocialLayouts || {});
// src/utils.ts
function value(src, next) {
    let k;
    if (src && next && typeof src === "object" && typeof next === "object") {
        if (Array.isArray(next)) {
            for(k = 0; k < next.length; k++){
                src[k] = value(src[k], next[k]);
            }
        } else {
            for(k in next){
                src[k] = value(src[k], next[k]);
            }
        }
        return src;
    }
    return next;
}
function merge(target, ...args) {
    let len = args.length;
    for(let i = 0; i < len; i++){
        target = value(target, args[i]);
    }
    return target;
}
function template(string, data) {
    return string.replace(/{{(\w+)}}/g, (placeholderWithDelimiters, placeholderWithoutDelimiters)=>data.hasOwnProperty(placeholderWithoutDelimiters) ? data[placeholderWithoutDelimiters] : placeholderWithDelimiters);
}
// src/localization/en.json
var en_default = {
    sign_up: {
        email_label: "Email address",
        password_label: "Create a Password",
        email_input_placeholder: "Your email address",
        password_input_placeholder: "Your password",
        button_label: "Sign up",
        loading_button_label: "Signing up ...",
        social_provider_text: "Sign in with {{provider}}",
        link_text: "Don't have an account? Sign up",
        confirmation_text: "Check your email for the confirmation link"
    },
    sign_in: {
        email_label: "Email address",
        password_label: "Your Password",
        email_input_placeholder: "Your email address",
        password_input_placeholder: "Your password",
        button_label: "Sign in",
        loading_button_label: "Signing in ...",
        social_provider_text: "Sign in with {{provider}}",
        link_text: "Already have an account? Sign in"
    },
    magic_link: {
        email_input_label: "Email address",
        email_input_placeholder: "Your email address",
        button_label: "Send Magic Link",
        loading_button_label: "Sending Magic Link ...",
        link_text: "Send a magic link email",
        confirmation_text: "Check your email for the magic link"
    },
    forgotten_password: {
        email_label: "Email address",
        password_label: "Your Password",
        email_input_placeholder: "Your email address",
        button_label: "Send reset password instructions",
        loading_button_label: "Sending reset instructions ...",
        link_text: "Forgot your password?",
        confirmation_text: "Check your email for the password reset link"
    },
    update_password: {
        password_label: "New password",
        password_input_placeholder: "Your new password",
        button_label: "Update password",
        loading_button_label: "Updating password ...",
        confirmation_text: "Your password has been updated"
    },
    verify_otp: {
        email_input_label: "Email address",
        email_input_placeholder: "Your email address",
        phone_input_label: "Phone number",
        phone_input_placeholder: "Your phone number",
        token_input_label: "Token",
        token_input_placeholder: "Your Otp token",
        button_label: "Verify token",
        loading_button_label: "Signing in ..."
    }
};
;
 //# sourceMappingURL=index.mjs.map
}),
"[project]/production/dad-strength-app/node_modules/@supabase/auth-ui-react/dist/index.es.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Auth",
    ()=>S,
    "AuthCard",
    ()=>j1,
    "ForgottenPassword",
    ()=>Q1,
    "MagicLink",
    ()=>Y1,
    "SignIn",
    ()=>K1,
    "SignUp",
    ()=>q1,
    "SocialAuth",
    ()=>J1,
    "UpdatePassword",
    ()=>X1,
    "VerifyOtp",
    ()=>e0
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/@stitches/core/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/@supabase/auth-ui-shared/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
;
;
const g1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    fontFamily: "$bodyFontFamily",
    fontSize: "$baseBodySize",
    marginBottom: "$anchorBottomMargin",
    color: "$anchorTextColor",
    display: "block",
    textAlign: "center",
    textDecoration: "underline",
    "&:hover": {
        color: "$anchorTextHoverColor"
    }
}), V = ({ children: t, appearance: l, ...n })=>{
    var o;
    const r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateClassNames"])("anchor", g1(), l);
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("a", {
        ...n,
        style: (o = l == null ? void 0 : l.style) == null ? void 0 : o.anchor,
        className: r.join(" ")
    }, t);
}, h1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    fontFamily: "$buttonFontFamily",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    borderRadius: "$borderRadiusButton",
    fontSize: "$baseButtonSize",
    padding: "$buttonPadding",
    cursor: "pointer",
    borderWidth: "$buttonBorderWidth",
    borderStyle: "solid",
    width: "100%",
    transitionProperty: "background-color",
    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    transitionDuration: "100ms",
    "&:disabled": {
        opacity: 0.7,
        cursor: "unset"
    },
    variants: {
        color: {
            default: {
                backgroundColor: "$defaultButtonBackground",
                color: "$defaultButtonText",
                borderColor: "$defaultButtonBorder",
                "&:hover:not(:disabled)": {
                    backgroundColor: "$defaultButtonBackgroundHover"
                }
            },
            primary: {
                backgroundColor: "$brand",
                color: "$brandButtonText",
                borderColor: "$brandAccent",
                "&:hover:not(:disabled)": {
                    backgroundColor: "$brandAccent"
                }
            }
        }
    }
}), U = ({ children: t, color: l = "default", appearance: n, icon: r, loading: o = !1, ...v })=>{
    var C;
    const E = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateClassNames"])("button", h1({
        color: l
    }), n);
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("button", {
        ...v,
        style: (C = n == null ? void 0 : n.style) == null ? void 0 : C.button,
        className: E.join(" "),
        disabled: o
    }, r, t);
}, f1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    display: "flex",
    gap: "4px",
    variants: {
        direction: {
            horizontal: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(48px, 1fr))"
            },
            vertical: {
                flexDirection: "column",
                margin: "8px 0"
            }
        },
        gap: {
            small: {
                gap: "4px"
            },
            medium: {
                gap: "8px"
            },
            large: {
                gap: "16px"
            }
        }
    }
}), N = ({ children: t, appearance: l, ...n })=>{
    var o;
    const r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateClassNames"])("container", f1({
        direction: n.direction,
        gap: n.gap
    }), l);
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", {
        ...n,
        style: (o = l == null ? void 0 : l.style) == null ? void 0 : o.container,
        className: r.join(" ")
    }, t);
}, E1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    background: "$dividerBackground",
    display: "block",
    margin: "16px 0",
    height: "1px",
    width: "100%"
}), C1 = ({ children: t, appearance: l, ...n })=>{
    var o;
    const r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateClassNames"])("divider", E1(), l);
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", {
        ...n,
        style: (o = l == null ? void 0 : l.style) == null ? void 0 : o.divider,
        className: r.join(" ")
    });
}, w1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    fontFamily: "$inputFontFamily",
    background: "$inputBackground",
    borderRadius: "$inputBorderRadius",
    padding: "$inputPadding",
    cursor: "text",
    borderWidth: "$inputBorderWidth",
    borderColor: "$inputBorder",
    borderStyle: "solid",
    fontSize: "$baseInputSize",
    width: "100%",
    color: "$inputText",
    boxSizing: "border-box",
    "&:hover": {
        borderColor: "$inputBorderHover",
        outline: "none"
    },
    "&:focus": {
        borderColor: "$inputBorderFocus",
        outline: "none"
    },
    "&::placeholder": {
        color: "$inputPlaceholder",
        letterSpacing: "initial"
    },
    transitionProperty: "background-color, border",
    transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    transitionDuration: "100ms",
    variants: {
        type: {
            default: {
                letterSpacing: "0px"
            },
            password: {
                letterSpacing: "0px"
            }
        }
    }
}), D = ({ children: t, appearance: l, ...n })=>{
    var o;
    const r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateClassNames"])("input", w1({
        type: n.type === "password" ? "password" : "default"
    }), l);
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("input", {
        ...n,
        style: (o = l == null ? void 0 : l.style) == null ? void 0 : o.input,
        className: r.join(" ")
    }, t);
}, v1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    fontFamily: "$labelFontFamily",
    fontSize: "$baseLabelSize",
    marginBottom: "$labelBottomMargin",
    color: "$inputLabelText",
    display: "block"
}), H = ({ children: t, appearance: l, ...n })=>{
    var o;
    const r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateClassNames"])("label", v1(), l);
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("label", {
        ...n,
        style: (o = l == null ? void 0 : l.style) == null ? void 0 : o.label,
        className: r.join(" ")
    }, t);
}, x1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    fontFamily: "$bodyFontFamily",
    fontSize: "$baseInputSize",
    marginBottom: "$labelBottomMargin",
    display: "block",
    textAlign: "center",
    borderRadius: "0.375rem",
    padding: "1.5rem 1rem",
    lineHeight: "1rem",
    color: "$messageText",
    backgroundColor: "$messageBackground",
    border: "1px solid $messageBorder",
    variants: {
        color: {
            danger: {
                color: "$messageTextDanger",
                backgroundColor: "$messageBackgroundDanger",
                border: "1px solid $messageBorderDanger"
            }
        }
    }
}), F = ({ children: t, appearance: l, ...n })=>{
    var o;
    const r = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["generateClassNames"])("message", x1({
        color: n.color
    }), l);
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("span", {
        ...n,
        style: (o = l == null ? void 0 : l.style) == null ? void 0 : o.message,
        className: r.join(" ")
    }, t);
};
function X({ setAuthView: t = ()=>{}, supabaseClient: l, redirectTo: n, i18n: r, appearance: o, showLinks: v = !1 }) {
    var _;
    const [E, C] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [w, d] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [i, m] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [c, y] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(!1), x = async (h)=>{
        var s, M;
        if (h.preventDefault(), d(""), m(""), y(!0), E.length === 0) {
            d((s = r == null ? void 0 : r.magic_link) == null ? void 0 : s.empty_email_address), y(!1);
            return;
        }
        const { error: g } = await l.auth.signInWithOtp({
            email: E,
            options: {
                emailRedirectTo: n
            }
        });
        g ? d(g.message) : m((M = r == null ? void 0 : r.magic_link) == null ? void 0 : M.confirmation_text), y(!1);
    }, a = r == null ? void 0 : r.magic_link;
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("form", {
        id: "auth-magic-link",
        onSubmit: x
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        gap: "large",
        direction: "vertical",
        appearance: o
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(H, {
        htmlFor: "email",
        appearance: o
    }, a == null ? void 0 : a.email_input_label), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(D, {
        id: "email",
        name: "email",
        type: "email",
        autoFocus: !0,
        placeholder: a == null ? void 0 : a.email_input_placeholder,
        onChange: (h)=>{
            d && d(""), C(h.target.value);
        },
        appearance: o
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(U, {
        color: "primary",
        type: "submit",
        loading: c,
        appearance: o
    }, c ? a == null ? void 0 : a.loading_button_label : a == null ? void 0 : a.button_label), v && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(V, {
        href: "#auth-sign-in",
        onClick: (h)=>{
            h.preventDefault(), t(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_IN);
        },
        appearance: o
    }, (_ = r == null ? void 0 : r.sign_in) == null ? void 0 : _.link_text), i && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        appearance: o
    }, i), w && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        color: "danger",
        appearance: o
    }, w)));
}
const L = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    width: "21px",
    height: "21px"
}), _1 = ({ provider: t })=>t == "google" ? y1() : t == "facebook" ? L1() : t == "twitter" ? b1() : t == "apple" ? p1() : t == "github" ? k1() : t == "gitlab" ? M1() : t == "bitbucket" ? S1() : t == "discord" ? N1() : t == "azure" ? F1() : t == "keycloak" ? z1() : t == "linkedin" ? $1() : t == "notion" ? B1() : t == "slack" ? D1() : t == "spotify" ? H1() : t == "twitch" ? P1() : t == "workos" ? V1() : t == "kakao" ? I1() : null, y1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#FFC107",
        d: "M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#FF3D00",
        d: "M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#4CAF50",
        d: "M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#1976D2",
        d: "M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
    })), L1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#039be5",
        d: "M24 5A19 19 0 1 0 24 43A19 19 0 1 0 24 5Z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#fff",
        d: "M26.572,29.036h4.917l0.772-4.995h-5.69v-2.73c0-2.075,0.678-3.915,2.619-3.915h3.119v-4.359c-0.548-0.074-1.707-0.236-3.897-0.236c-4.573,0-7.254,2.415-7.254,7.917v3.323h-4.701v4.995h4.701v13.729C22.089,42.905,23.032,43,24,43c0.875,0,1.729-0.08,2.572-0.194V29.036z"
    })), b1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#03A9F4",
        d: "M42,12.429c-1.323,0.586-2.746,0.977-4.247,1.162c1.526-0.906,2.7-2.351,3.251-4.058c-1.428,0.837-3.01,1.452-4.693,1.776C34.967,9.884,33.05,9,30.926,9c-4.08,0-7.387,3.278-7.387,7.32c0,0.572,0.067,1.129,0.193,1.67c-6.138-0.308-11.582-3.226-15.224-7.654c-0.64,1.082-1,2.349-1,3.686c0,2.541,1.301,4.778,3.285,6.096c-1.211-0.037-2.351-0.374-3.349-0.914c0,0.022,0,0.055,0,0.086c0,3.551,2.547,6.508,5.923,7.181c-0.617,0.169-1.269,0.263-1.941,0.263c-0.477,0-0.942-0.054-1.392-0.135c0.94,2.902,3.667,5.023,6.898,5.086c-2.528,1.96-5.712,3.134-9.174,3.134c-0.598,0-1.183-0.034-1.761-0.104C9.268,36.786,13.152,38,17.321,38c13.585,0,21.017-11.156,21.017-20.834c0-0.317-0.01-0.633-0.025-0.945C39.763,15.197,41.013,13.905,42,12.429"
    })), p1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        fill: "gray",
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        width: "21px",
        height: "21px"
    }, " ", /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M 15.904297 1.078125 C 15.843359 1.06875 15.774219 1.0746094 15.699219 1.0996094 C 14.699219 1.2996094 13.600391 1.8996094 12.900391 2.5996094 C 12.300391 3.1996094 11.800781 4.1996094 11.800781 5.0996094 C 11.800781 5.2996094 11.999219 5.5 12.199219 5.5 C 13.299219 5.4 14.399609 4.7996094 15.099609 4.0996094 C 15.699609 3.2996094 16.199219 2.4 16.199219 1.5 C 16.199219 1.275 16.087109 1.10625 15.904297 1.078125 z M 16.199219 5.4003906 C 14.399219 5.4003906 13.600391 6.5 12.400391 6.5 C 11.100391 6.5 9.9003906 5.5 8.4003906 5.5 C 6.3003906 5.5 3.0996094 7.4996094 3.0996094 12.099609 C 2.9996094 16.299609 6.8 21 9 21 C 10.3 21 10.600391 20.199219 12.400391 20.199219 C 14.200391 20.199219 14.600391 21 15.900391 21 C 17.400391 21 18.500391 19.399609 19.400391 18.099609 C 19.800391 17.399609 20.100391 17.000391 20.400391 16.400391 C 20.600391 16.000391 20.4 15.600391 20 15.400391 C 17.4 14.100391 16.900781 9.9003906 19.800781 8.4003906 C 20.300781 8.1003906 20.4 7.4992188 20 7.1992188 C 18.9 6.1992187 17.299219 5.4003906 16.199219 5.4003906 z"
    })), k1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        fill: "gray",
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 30 30",
        width: "21px",
        height: "21px"
    }, " ", /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M15,3C8.373,3,3,8.373,3,15c0,5.623,3.872,10.328,9.092,11.63C12.036,26.468,12,26.28,12,26.047v-2.051 c-0.487,0-1.303,0-1.508,0c-0.821,0-1.551-0.353-1.905-1.009c-0.393-0.729-0.461-1.844-1.435-2.526 c-0.289-0.227-0.069-0.486,0.264-0.451c0.615,0.174,1.125,0.596,1.605,1.222c0.478,0.627,0.703,0.769,1.596,0.769 c0.433,0,1.081-0.025,1.691-0.121c0.328-0.833,0.895-1.6,1.588-1.962c-3.996-0.411-5.903-2.399-5.903-5.098 c0-1.162,0.495-2.286,1.336-3.233C9.053,10.647,8.706,8.73,9.435,8c1.798,0,2.885,1.166,3.146,1.481C13.477,9.174,14.461,9,15.495,9 c1.036,0,2.024,0.174,2.922,0.483C18.675,9.17,19.763,8,21.565,8c0.732,0.731,0.381,2.656,0.102,3.594 c0.836,0.945,1.328,2.066,1.328,3.226c0,2.697-1.904,4.684-5.894,5.097C18.199,20.49,19,22.1,19,23.313v2.734 c0,0.104-0.023,0.179-0.035,0.268C23.641,24.676,27,20.236,27,15C27,8.373,21.627,3,15,3z"
    })), M1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#e53935",
        d: "M24 43L16 20 32 20z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#ff7043",
        d: "M24 43L42 20 32 20z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#e53935",
        d: "M37 5L42 20 32 20z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#ffa726",
        d: "M24 43L42 20 45 28z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#ff7043",
        d: "M24 43L6 20 16 20z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#e53935",
        d: "M11 5L6 20 16 20z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#ffa726",
        d: "M24 43L6 20 3 28z"
    })), S1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        width: "512",
        height: "512",
        viewBox: "0 0 62.42 62.42"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("defs", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("linearGradient", {
        id: "New_Gradient_Swatch_1",
        x1: "64.01",
        y1: "30.27",
        x2: "32.99",
        y2: "54.48",
        gradientUnits: "userSpaceOnUse"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: "0.18",
        stopColor: "#0052cc"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: "1",
        stopColor: "#2684ff"
    }))), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("title", null, "Bitbucket-blue"), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("g", {
        id: "Layer_2",
        "data-name": "Layer 2"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("g", {
        id: "Blue",
        transform: "translate(0 -3.13)"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M2,6.26A2,2,0,0,0,0,8.58L8.49,60.12a2.72,2.72,0,0,0,2.66,2.27H51.88a2,2,0,0,0,2-1.68L62.37,8.59a2,2,0,0,0-2-2.32ZM37.75,43.51h-13L21.23,25.12H40.9Z",
        fill: "#2684ff"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M59.67,25.12H40.9L37.75,43.51h-13L9.4,61.73a2.71,2.71,0,0,0,1.75.66H51.89a2,2,0,0,0,2-1.68Z",
        fill: "url(#New_Gradient_Swatch_1)"
    })))), N1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#536dfe",
        d: "M39.248,10.177c-2.804-1.287-5.812-2.235-8.956-2.778c-0.057-0.01-0.114,0.016-0.144,0.068	c-0.387,0.688-0.815,1.585-1.115,2.291c-3.382-0.506-6.747-0.506-10.059,0c-0.3-0.721-0.744-1.603-1.133-2.291	c-0.03-0.051-0.087-0.077-0.144-0.068c-3.143,0.541-6.15,1.489-8.956,2.778c-0.024,0.01-0.045,0.028-0.059,0.051	c-5.704,8.522-7.267,16.835-6.5,25.044c0.003,0.04,0.026,0.079,0.057,0.103c3.763,2.764,7.409,4.442,10.987,5.554	c0.057,0.017,0.118-0.003,0.154-0.051c0.846-1.156,1.601-2.374,2.248-3.656c0.038-0.075,0.002-0.164-0.076-0.194	c-1.197-0.454-2.336-1.007-3.432-1.636c-0.087-0.051-0.094-0.175-0.014-0.234c0.231-0.173,0.461-0.353,0.682-0.534	c0.04-0.033,0.095-0.04,0.142-0.019c7.201,3.288,14.997,3.288,22.113,0c0.047-0.023,0.102-0.016,0.144,0.017	c0.22,0.182,0.451,0.363,0.683,0.536c0.08,0.059,0.075,0.183-0.012,0.234c-1.096,0.641-2.236,1.182-3.434,1.634	c-0.078,0.03-0.113,0.12-0.075,0.196c0.661,1.28,1.415,2.498,2.246,3.654c0.035,0.049,0.097,0.07,0.154,0.052	c3.595-1.112,7.241-2.79,11.004-5.554c0.033-0.024,0.054-0.061,0.057-0.101c0.917-9.491-1.537-17.735-6.505-25.044	C39.293,10.205,39.272,10.187,39.248,10.177z M16.703,30.273c-2.168,0-3.954-1.99-3.954-4.435s1.752-4.435,3.954-4.435	c2.22,0,3.989,2.008,3.954,4.435C20.658,28.282,18.906,30.273,16.703,30.273z M31.324,30.273c-2.168,0-3.954-1.99-3.954-4.435	s1.752-4.435,3.954-4.435c2.22,0,3.989,2.008,3.954,4.435C35.278,28.282,33.544,30.273,31.324,30.273z"
    })), F1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("linearGradient", {
        id: "k8yl7~hDat~FaoWq8WjN6a",
        x1: "-1254.397",
        x2: "-1261.911",
        y1: "877.268",
        y2: "899.466",
        gradientTransform: "translate(1981.75 -1362.063) scale(1.5625)",
        gradientUnits: "userSpaceOnUse"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: "0",
        stopColor: "#114a8b"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: "1",
        stopColor: "#0669bc"
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "url(#k8yl7~hDat~FaoWq8WjN6a)",
        d: "M17.634,6h11.305L17.203,40.773c-0.247,0.733-0.934,1.226-1.708,1.226H6.697 c-0.994,0-1.8-0.806-1.8-1.8c0-0.196,0.032-0.39,0.094-0.576L15.926,7.227C16.173,6.494,16.86,6,17.634,6L17.634,6z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#0078d4",
        d: "M34.062,29.324H16.135c-0.458-0.001-0.83,0.371-0.831,0.829c0,0.231,0.095,0.451,0.264,0.608 l11.52,10.752C27.423,41.826,27.865,42,28.324,42h10.151L34.062,29.324z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("linearGradient", {
        id: "k8yl7~hDat~FaoWq8WjN6b",
        x1: "-1252.05",
        x2: "-1253.788",
        y1: "887.612",
        y2: "888.2",
        gradientTransform: "translate(1981.75 -1362.063) scale(1.5625)",
        gradientUnits: "userSpaceOnUse"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: "0",
        stopOpacity: ".3"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: ".071",
        stopOpacity: ".2"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: ".321",
        stopOpacity: ".1"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: ".623",
        stopOpacity: ".05"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: "1",
        stopOpacity: "0"
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "url(#k8yl7~hDat~FaoWq8WjN6b)",
        d: "M17.634,6c-0.783-0.003-1.476,0.504-1.712,1.25L5.005,39.595 c-0.335,0.934,0.151,1.964,1.085,2.299C6.286,41.964,6.493,42,6.702,42h9.026c0.684-0.122,1.25-0.603,1.481-1.259l2.177-6.416 l7.776,7.253c0.326,0.27,0.735,0.419,1.158,0.422h10.114l-4.436-12.676l-12.931,0.003L28.98,6H17.634z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("linearGradient", {
        id: "k8yl7~hDat~FaoWq8WjN6c",
        x1: "-1252.952",
        x2: "-1244.704",
        y1: "876.6",
        y2: "898.575",
        gradientTransform: "translate(1981.75 -1362.063) scale(1.5625)",
        gradientUnits: "userSpaceOnUse"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: "0",
        stopColor: "#3ccbf4"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("stop", {
        offset: "1",
        stopColor: "#2892df"
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "url(#k8yl7~hDat~FaoWq8WjN6c)",
        d: "M32.074,7.225C31.827,6.493,31.141,6,30.368,6h-12.6c0.772,0,1.459,0.493,1.705,1.224 l10.935,32.399c0.318,0.942-0.188,1.963-1.13,2.281C29.093,41.968,28.899,42,28.703,42h12.6c0.994,0,1.8-0.806,1.8-1.801 c0-0.196-0.032-0.39-0.095-0.575L32.074,7.225z"
    })), z1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        width: "512",
        height: "512",
        viewBox: "0 0 512 512",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M472.136 163.959H408.584C407.401 163.959 406.218 163.327 405.666 162.3L354.651 73.6591C354.02 72.632 352.916 72 351.654 72H143.492C142.309 72 141.126 72.632 140.574 73.6591L87.5084 165.618L36.414 254.259C35.862 255.286 35.862 256.55 36.414 257.656L87.5084 346.297L140.495 438.335C141.047 439.362 142.23 440.073 143.413 439.994H351.654C352.837 439.994 354.02 439.362 354.651 438.335L405.745 349.694C406.297 348.667 407.48 347.956 408.663 348.035H472.215C474.344 348.035 476 346.297 476 344.243V167.83C475.921 165.697 474.186 163.959 472.136 163.959ZM228.728 349.694L212.721 377.345C212.485 377.74 212.091 378.135 211.696 378.372C211.223 378.609 210.75 378.767 210.198 378.767H178.422C177.318 378.767 176.293 378.214 175.82 377.187L128.431 294.787L123.779 286.65L106.748 257.498C106.511 257.103 106.353 256.629 106.432 256.076C106.432 255.602 106.59 255.049 106.827 254.654L123.937 224.949L175.899 134.886C176.451 133.938 177.476 133.306 178.501 133.306H210.198C210.75 133.306 211.302 133.464 211.854 133.701C212.248 133.938 212.643 134.254 212.879 134.728L228.886 162.537C229.359 163.485 229.28 164.67 228.728 165.539L177.397 254.654C177.16 255.049 177.081 255.523 177.081 255.918C177.081 256.392 177.239 256.787 177.397 257.182L228.728 346.218C229.438 347.403 229.359 348.667 228.728 349.694V349.694ZM388.083 257.498L371.051 286.65L366.399 294.787L319.011 377.187C318.459 378.135 317.512 378.767 316.409 378.767H284.632C284.08 378.767 283.607 378.609 283.134 378.372C282.74 378.135 282.346 377.819 282.109 377.345L266.103 349.694C265.393 348.667 265.393 347.403 266.024 346.376L317.355 257.34C317.591 256.945 317.67 256.471 317.67 256.076C317.67 255.602 317.513 255.207 317.355 254.812L266.024 165.697C265.472 164.749 265.393 163.643 265.866 162.695L281.873 134.886C282.109 134.491 282.503 134.096 282.898 133.859C283.371 133.543 283.923 133.464 284.553 133.464H316.409C317.512 133.464 318.538 134.017 319.011 135.044L370.972 225.107L388.083 254.812C388.319 255.286 388.477 255.76 388.477 256.234C388.477 256.55 388.319 257.024 388.083 257.498V257.498Z",
        fill: "#008AAA"
    })), $1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#0288D1",
        d: "M42,37c0,2.762-2.238,5-5,5H11c-2.761,0-5-2.238-5-5V11c0-2.762,2.239-5,5-5h26c2.762,0,5,2.238,5,5V37z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#FFF",
        d: "M12 19H17V36H12zM14.485 17h-.028C12.965 17 12 15.888 12 14.499 12 13.08 12.995 12 14.514 12c1.521 0 2.458 1.08 2.486 2.499C17 15.887 16.035 17 14.485 17zM36 36h-5v-9.099c0-2.198-1.225-3.698-3.192-3.698-1.501 0-2.313 1.012-2.707 1.99C24.957 25.543 25 26.511 25 27v9h-5V19h5v2.616C25.721 20.5 26.85 19 29.738 19c3.578 0 6.261 2.25 6.261 7.274L36 36 36 36z"
    })), B1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px",
        fillRule: "evenodd",
        clipRule: "evenodd"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#fff",
        fillRule: "evenodd",
        d: "M11.553,11.099c1.232,1.001,1.694,0.925,4.008,0.77 l21.812-1.31c0.463,0,0.078-0.461-0.076-0.538l-3.622-2.619c-0.694-0.539-1.619-1.156-3.391-1.002l-21.12,1.54 c-0.77,0.076-0.924,0.461-0.617,0.77L11.553,11.099z",
        clipRule: "evenodd"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#fff",
        fillRule: "evenodd",
        d: "M12.862,16.182v22.95c0,1.233,0.616,1.695,2.004,1.619 l23.971-1.387c1.388-0.076,1.543-0.925,1.543-1.927V14.641c0-1-0.385-1.54-1.234-1.463l-25.05,1.463 C13.171,14.718,12.862,15.181,12.862,16.182L12.862,16.182z",
        clipRule: "evenodd"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#424242",
        fillRule: "evenodd",
        d: "M11.553,11.099c1.232,1.001,1.694,0.925,4.008,0.77 l21.812-1.31c0.463,0,0.078-0.461-0.076-0.538l-3.622-2.619c-0.694-0.539-1.619-1.156-3.391-1.002l-21.12,1.54 c-0.77,0.076-0.924,0.461-0.617,0.77L11.553,11.099z M12.862,16.182v22.95c0,1.233,0.616,1.695,2.004,1.619l23.971-1.387 c1.388-0.076,1.543-0.925,1.543-1.927V14.641c0-1-0.385-1.54-1.234-1.463l-25.05,1.463C13.171,14.718,12.862,15.181,12.862,16.182 L12.862,16.182z M36.526,17.413c0.154,0.694,0,1.387-0.695,1.465l-1.155,0.23v16.943c-1.003,0.539-1.928,0.847-2.698,0.847 c-1.234,0-1.543-0.385-2.467-1.54l-7.555-11.86v11.475l2.391,0.539c0,0,0,1.386-1.929,1.386l-5.317,0.308 c-0.154-0.308,0-1.078,0.539-1.232l1.388-0.385V20.418l-1.927-0.154c-0.155-0.694,0.23-1.694,1.31-1.772l5.704-0.385l7.862,12.015 V19.493l-2.005-0.23c-0.154-0.848,0.462-1.464,1.233-1.54L36.526,17.413z M7.389,5.862l21.968-1.618 c2.698-0.231,3.392-0.076,5.087,1.155l7.013,4.929C42.614,11.176,43,11.407,43,12.33v27.032c0,1.694-0.617,2.696-2.775,2.849 l-25.512,1.541c-1.62,0.077-2.391-0.154-3.239-1.232l-5.164-6.7C5.385,34.587,5,33.664,5,32.585V8.556 C5,7.171,5.617,6.015,7.389,5.862z",
        clipRule: "evenodd"
    })), D1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 48 48",
        width: "21px",
        height: "21px"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#33d375",
        d: "M33,8c0-2.209-1.791-4-4-4s-4,1.791-4,4c0,1.254,0,9.741,0,11c0,2.209,1.791,4,4,4s4-1.791,4-4	C33,17.741,33,9.254,33,8z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#33d375",
        d: "M43,19c0,2.209-1.791,4-4,4c-1.195,0-4,0-4,0s0-2.986,0-4c0-2.209,1.791-4,4-4S43,16.791,43,19z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#40c4ff",
        d: "M8,14c-2.209,0-4,1.791-4,4s1.791,4,4,4c1.254,0,9.741,0,11,0c2.209,0,4-1.791,4-4s-1.791-4-4-4	C17.741,14,9.254,14,8,14z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#40c4ff",
        d: "M19,4c2.209,0,4,1.791,4,4c0,1.195,0,4,0,4s-2.986,0-4,0c-2.209,0-4-1.791-4-4S16.791,4,19,4z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#e91e63",
        d: "M14,39.006C14,41.212,15.791,43,18,43s4-1.788,4-3.994c0-1.252,0-9.727,0-10.984	c0-2.206-1.791-3.994-4-3.994s-4,1.788-4,3.994C14,29.279,14,37.754,14,39.006z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#e91e63",
        d: "M4,28.022c0-2.206,1.791-3.994,4-3.994c1.195,0,4,0,4,0s0,2.981,0,3.994c0,2.206-1.791,3.994-4,3.994	S4,30.228,4,28.022z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#ffc107",
        d: "M39,33c2.209,0,4-1.791,4-4s-1.791-4-4-4c-1.254,0-9.741,0-11,0c-2.209,0-4,1.791-4,4s1.791,4,4,4	C29.258,33,37.746,33,39,33z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#ffc107",
        d: "M28,43c-2.209,0-4-1.791-4-4c0-1.195,0-4,0-4s2.986,0,4,0c2.209,0,4,1.791,4,4S30.209,43,28,43z"
    })), H1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        width: "512",
        height: "512",
        viewBox: "0 0 512 512",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M255.498 31.0034C131.513 31.0034 31 131.515 31 255.502C31 379.492 131.513 480 255.498 480C379.497 480 480 379.495 480 255.502C480 131.522 379.497 31.0135 255.495 31.0135L255.498 31V31.0034ZM358.453 354.798C354.432 361.391 345.801 363.486 339.204 359.435C286.496 327.237 220.139 319.947 141.993 337.801C134.463 339.516 126.957 334.798 125.24 327.264C123.516 319.731 128.217 312.225 135.767 310.511C221.284 290.972 294.639 299.384 353.816 335.549C360.413 339.596 362.504 348.2 358.453 354.798ZM385.932 293.67C380.864 301.903 370.088 304.503 361.858 299.438C301.512 262.345 209.528 251.602 138.151 273.272C128.893 276.067 119.118 270.851 116.309 261.61C113.521 252.353 118.74 242.597 127.981 239.782C209.512 215.044 310.87 227.026 380.17 269.612C388.4 274.68 391 285.456 385.935 293.676V293.673L385.932 293.67ZM388.293 230.016C315.935 187.039 196.56 183.089 127.479 204.055C116.387 207.42 104.654 201.159 101.293 190.063C97.9326 178.964 104.189 167.241 115.289 163.87C194.59 139.796 326.418 144.446 409.723 193.902C419.722 199.826 422.995 212.71 417.068 222.675C411.168 232.653 398.247 235.943 388.303 230.016H388.293V230.016Z",
        fill: "#1ED760"
    })), P1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        width: "512",
        height: "512",
        viewBox: "0 0 512 512",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M416 240L352 304H288L232 360V304H160V64H416V240Z",
        fill: "white"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M144 32L64 112V400H160V480L240 400H304L448 256V32H144ZM416 240L352 304H288L232 360V304H160V64H416V240Z",
        fill: "#9146FF"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M368 120H336V216H368V120Z",
        fill: "#9146FF"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M280 120H248V216H280V120Z",
        fill: "#9146FF"
    })), V1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        width: "512",
        height: "512",
        viewBox: "0 0 512 512",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M33 256.043C33 264.556 35.3159 273.069 39.4845 280.202L117.993 415.493C126.098 429.298 138.373 440.572 153.657 445.634C183.764 455.528 214.797 442.873 229.618 417.333L248.609 384.661L173.806 256.043L252.777 119.831L271.768 87.1591C277.557 77.2654 284.968 69.4424 294 63H285.894H172.185C150.878 63 131.193 74.2742 120.54 92.6812L39.7161 231.884C35.3159 239.016 33 247.53 33 256.043Z",
        fill: "#6363F1"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M480 256.058C480 247.539 477.684 239.021 473.516 231.883L393.849 94.6596C379.028 69.3331 347.995 56.4396 317.888 66.34C302.603 71.4053 290.329 82.6871 282.224 96.5015L264.391 127.354L339.194 256.058L260.223 392.131L241.232 424.825C235.443 434.495 228.032 442.553 219 449H227.106H340.815C362.122 449 381.807 437.718 392.46 419.299L473.284 280.003C477.684 272.866 480 264.577 480 256.058Z",
        fill: "#6363F1"
    })), I1 = ()=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("svg", {
        className: L(),
        xmlns: "http://www.w3.org/2000/svg",
        width: "2500",
        height: "2500",
        viewBox: "0 0 256 256"
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#FFE812",
        d: "M256 236c0 11.046-8.954 20-20 20H20c-11.046 0-20-8.954-20-20V20C0 8.954 8.954 0 20 0h216c11.046 0 20 8.954 20 20v216z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        d: "M128 36C70.562 36 24 72.713 24 118c0 29.279 19.466 54.97 48.748 69.477-1.593 5.494-10.237 35.344-10.581 37.689 0 0-.207 1.762.934 2.434s2.483.15 2.483.15c3.272-.457 37.943-24.811 43.944-29.04 5.995.849 12.168 1.29 18.472 1.29 57.438 0 104-36.712 104-82 0-45.287-46.562-82-104-82z"
    }), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("path", {
        fill: "#FFE812",
        d: "M70.5 146.625c-3.309 0-6-2.57-6-5.73V105.25h-9.362c-3.247 0-5.888-2.636-5.888-5.875s2.642-5.875 5.888-5.875h30.724c3.247 0 5.888 2.636 5.888 5.875s-2.642 5.875-5.888 5.875H76.5v35.645c0 3.16-2.691 5.73-6 5.73zM123.112 146.547c-2.502 0-4.416-1.016-4.993-2.65l-2.971-7.778-18.296-.001-2.973 7.783c-.575 1.631-2.488 2.646-4.99 2.646a9.155 9.155 0 0 1-3.814-.828c-1.654-.763-3.244-2.861-1.422-8.52l14.352-37.776c1.011-2.873 4.082-5.833 7.99-5.922 3.919.088 6.99 3.049 8.003 5.928l14.346 37.759c1.826 5.672.236 7.771-1.418 8.532a9.176 9.176 0 0 1-3.814.827c-.001 0 0 0 0 0zm-11.119-21.056L106 108.466l-5.993 17.025h11.986zM138 145.75c-3.171 0-5.75-2.468-5.75-5.5V99.5c0-3.309 2.748-6 6.125-6s6.125 2.691 6.125 6v35.25h12.75c3.171 0 5.75 2.468 5.75 5.5s-2.579 5.5-5.75 5.5H138zM171.334 146.547c-3.309 0-6-2.691-6-6V99.5c0-3.309 2.691-6 6-6s6 2.691 6 6v12.896l16.74-16.74c.861-.861 2.044-1.335 3.328-1.335 1.498 0 3.002.646 4.129 1.772 1.051 1.05 1.678 2.401 1.764 3.804.087 1.415-.384 2.712-1.324 3.653l-13.673 13.671 14.769 19.566a5.951 5.951 0 0 1 1.152 4.445 5.956 5.956 0 0 1-2.328 3.957 5.94 5.94 0 0 1-3.609 1.211 5.953 5.953 0 0 1-4.793-2.385l-14.071-18.644-2.082 2.082v13.091a6.01 6.01 0 0 1-6.002 6.003z"
    }));
function A1({ supabaseClient: t, socialLayout: l = "vertical", providers: n = [
    "github",
    "google",
    "azure"
], providerScopes: r, queryParams: o, redirectTo: v, onlyThirdPartyProviders: E = !0, view: C = "sign_in", i18n: w, appearance: d }) {
    const [i, m] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(!1), [c, y] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), x = l === "vertical", a = C === "magic_link" ? "sign_in" : C, _ = async (g)=>{
        m(!0);
        const { error: s } = await t.auth.signInWithOAuth({
            provider: g,
            options: {
                redirectTo: v,
                scopes: r == null ? void 0 : r[g],
                queryParams: o
            }
        });
        s && y(s.message), m(!1);
    };
    function h(g) {
        const s = g.toLowerCase();
        return g.charAt(0).toUpperCase() + s.slice(1);
    }
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Fragment, null, n && n.length > 0 && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].Fragment, null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        gap: "large",
        direction: "vertical",
        appearance: d
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        direction: x ? "vertical" : "horizontal",
        gap: x ? "small" : "medium",
        appearance: d
    }, n.map((g)=>{
        var s;
        return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(U, {
            key: g,
            color: "default",
            loading: i,
            onClick: ()=>_(g),
            appearance: d
        }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(_1, {
            provider: g
        }), x && (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["template"])((s = w == null ? void 0 : w[a]) == null ? void 0 : s.social_provider_text, {
            provider: h(g)
        }));
    }))), !E && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(C1, {
        appearance: d
    })));
}
function Q({ authView: t = "sign_in", defaultEmail: l = "", defaultPassword: n = "", setAuthView: r = ()=>{}, setDefaultEmail: o = (x)=>{}, setDefaultPassword: v = (x)=>{}, supabaseClient: E, showLinks: C = !1, redirectTo: w, additionalData: d, magicLink: i, i18n: m, appearance: c, children: y }) {
    var T, G, Z, j;
    const x = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(!0), [a, _] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(l), [h, g] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(n), [s, M] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [p, B] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(!1), [P, A] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(()=>(x.current = !0, _(l), g(n), ()=>{
            x.current = !1;
        }), [
        t
    ]);
    const O = async (k)=>{
        var q;
        switch(k.preventDefault(), M(""), B(!0), t){
            case "sign_in":
                const { error: K } = await E.auth.signInWithPassword({
                    email: a,
                    password: h
                });
                K && M(K.message);
                break;
            case "sign_up":
                let Y = {
                    emailRedirectTo: w
                };
                d && (Y.data = d);
                const { data: { user: r1, session: o1 }, error: J } = await E.auth.signUp({
                    email: a,
                    password: h,
                    options: Y
                });
                J ? M(J.message) : r1 && !o1 && A((q = m == null ? void 0 : m.sign_up) == null ? void 0 : q.confirmation_text);
                break;
        }
        x.current && B(!1);
    }, z = (k)=>{
        o(a), v(h), r(k);
    }, f = m == null ? void 0 : m[t];
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("form", {
        id: t === "sign_in" ? "auth-sign-in" : "auth-sign-up",
        onSubmit: O,
        autoComplete: "on",
        style: {
            width: "100%"
        }
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        direction: "vertical",
        gap: "large",
        appearance: c
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        direction: "vertical",
        gap: "large",
        appearance: c
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(H, {
        htmlFor: "email",
        appearance: c
    }, f == null ? void 0 : f.email_label), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(D, {
        id: "email",
        type: "email",
        name: "email",
        placeholder: f == null ? void 0 : f.email_input_placeholder,
        defaultValue: a,
        onChange: (k)=>_(k.target.value),
        autoComplete: "email",
        appearance: c
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(H, {
        htmlFor: "password",
        appearance: c
    }, f == null ? void 0 : f.password_label), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(D, {
        id: "password",
        type: "password",
        name: "password",
        placeholder: f == null ? void 0 : f.password_input_placeholder,
        defaultValue: h,
        onChange: (k)=>g(k.target.value),
        autoComplete: t === "sign_in" ? "current-password" : "new-password",
        appearance: c
    })), y), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(U, {
        type: "submit",
        color: "primary",
        loading: p,
        appearance: c
    }, p ? f == null ? void 0 : f.loading_button_label : f == null ? void 0 : f.button_label), C && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        direction: "vertical",
        gap: "small",
        appearance: c
    }, t === __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_IN && i && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(V, {
        href: "#auth-magic-link",
        onClick: (k)=>{
            k.preventDefault(), r(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].MAGIC_LINK);
        },
        appearance: c
    }, (T = m == null ? void 0 : m.magic_link) == null ? void 0 : T.link_text), t === __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_IN && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(V, {
        href: "#auth-forgot-password",
        onClick: (k)=>{
            k.preventDefault(), r(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].FORGOTTEN_PASSWORD);
        },
        appearance: c
    }, (G = m == null ? void 0 : m.forgotten_password) == null ? void 0 : G.link_text), t === __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_IN ? /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(V, {
        href: "#auth-sign-up",
        onClick: (k)=>{
            k.preventDefault(), z(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_UP);
        },
        appearance: c
    }, (Z = m == null ? void 0 : m.sign_up) == null ? void 0 : Z.link_text) : /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(V, {
        href: "#auth-sign-in",
        onClick: (k)=>{
            k.preventDefault(), z(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_IN);
        },
        appearance: c
    }, (j = m == null ? void 0 : m.sign_in) == null ? void 0 : j.link_text))), P && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        appearance: c
    }, P), s && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        color: "danger",
        appearance: c
    }, s));
}
function e1({ setAuthView: t = ()=>{}, supabaseClient: l, redirectTo: n, i18n: r, appearance: o, showLinks: v = !1 }) {
    var _;
    const [E, C] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [w, d] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [i, m] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [c, y] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(!1), x = async (h)=>{
        var s;
        h.preventDefault(), d(""), m(""), y(!0);
        const { error: g } = await l.auth.resetPasswordForEmail(E, {
            redirectTo: n
        });
        g ? d(g.message) : m((s = r == null ? void 0 : r.forgotten_password) == null ? void 0 : s.confirmation_text), y(!1);
    }, a = r == null ? void 0 : r.forgotten_password;
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("form", {
        id: "auth-forgot-password",
        onSubmit: x
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        direction: "vertical",
        gap: "large",
        appearance: o
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        gap: "large",
        direction: "vertical",
        appearance: o
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(H, {
        htmlFor: "email",
        appearance: o
    }, a == null ? void 0 : a.email_label), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(D, {
        id: "email",
        name: "email",
        type: "email",
        autoFocus: !0,
        placeholder: a == null ? void 0 : a.email_input_placeholder,
        onChange: (h)=>C(h.target.value),
        appearance: o
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(U, {
        type: "submit",
        color: "primary",
        loading: c,
        appearance: o
    }, c ? a == null ? void 0 : a.loading_button_label : a == null ? void 0 : a.button_label), v && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(V, {
        href: "#auth-sign-in",
        onClick: (h)=>{
            h.preventDefault(), t(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_IN);
        },
        appearance: o
    }, (_ = r == null ? void 0 : r.sign_in) == null ? void 0 : _.link_text), i && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        appearance: o
    }, i), w && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        color: "danger",
        appearance: o
    }, w))));
}
function t1({ supabaseClient: t, i18n: l, appearance: n }) {
    const [r, o] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [v, E] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [C, w] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [d, i] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(!1), m = async (y)=>{
        var a;
        y.preventDefault(), E(""), w(""), i(!0);
        const { error: x } = await t.auth.updateUser({
            password: r
        });
        x ? E(x.message) : w((a = l == null ? void 0 : l.update_password) == null ? void 0 : a.confirmation_text), i(!1);
    }, c = l == null ? void 0 : l.update_password;
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("form", {
        id: "auth-update-password",
        onSubmit: m
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        gap: "large",
        direction: "vertical",
        appearance: n
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(H, {
        htmlFor: "password",
        appearance: n
    }, c == null ? void 0 : c.password_label), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(D, {
        id: "password",
        name: "password",
        placeholder: c == null ? void 0 : c.password_input_placeholder,
        type: "password",
        autoFocus: !0,
        onChange: (y)=>o(y.target.value),
        appearance: n
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(U, {
        type: "submit",
        color: "primary",
        loading: d,
        appearance: n
    }, d ? c == null ? void 0 : c.loading_button_label : c == null ? void 0 : c.button_label), C && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        appearance: n
    }, C), v && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        color: "danger",
        appearance: n
    }, v)));
}
function U1({ setAuthView: t = ()=>{}, supabaseClient: l, otpType: n = "email", i18n: r, appearance: o, showLinks: v = !1 }) {
    var M;
    const [E, C] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [w, d] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [i, m] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [c, y] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [x, a] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [_, h] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(!1), g = async (p)=>{
        p.preventDefault(), y(""), a(""), h(!0);
        let B = {
            email: E,
            token: i,
            type: n
        };
        [
            "sms",
            "phone_change"
        ].includes(n) && (B = {
            phone: w,
            token: i,
            type: n
        });
        const { error: P } = await l.auth.verifyOtp(B);
        P && y(P.message), h(!1);
    }, s = r == null ? void 0 : r.verify_otp;
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("form", {
        id: "auth-magic-link",
        onSubmit: g
    }, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(N, {
        gap: "large",
        direction: "vertical",
        appearance: o
    }, [
        "sms",
        "phone_change"
    ].includes(n) ? /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(H, {
        htmlFor: "phone",
        appearance: o
    }, s == null ? void 0 : s.phone_input_label), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(D, {
        id: "phone",
        name: "phone",
        type: "text",
        autoFocus: !0,
        placeholder: s == null ? void 0 : s.phone_input_placeholder,
        onChange: (p)=>d(p.target.value),
        appearance: o
    })) : /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(H, {
        htmlFor: "email",
        appearance: o
    }, s == null ? void 0 : s.email_input_label), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(D, {
        id: "email",
        name: "email",
        type: "email",
        autoFocus: !0,
        placeholder: s == null ? void 0 : s.email_input_placeholder,
        onChange: (p)=>C(p.target.value),
        appearance: o
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(H, {
        htmlFor: "token",
        appearance: o
    }, s == null ? void 0 : s.token_input_label), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(D, {
        id: "token",
        name: "token",
        type: "text",
        placeholder: s == null ? void 0 : s.token_input_placeholder,
        onChange: (p)=>m(p.target.value),
        appearance: o
    })), /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(U, {
        color: "primary",
        type: "submit",
        loading: _,
        appearance: o
    }, _ ? s == null ? void 0 : s.loading_button_label : s == null ? void 0 : s.button_label), v && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(V, {
        href: "#auth-sign-in",
        onClick: (p)=>{
            p.preventDefault(), t(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_IN);
        },
        appearance: o
    }, (M = r == null ? void 0 : r.sign_in) == null ? void 0 : M.link_text), x && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        appearance: o
    }, x), c && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(F, {
        color: "danger",
        appearance: o
    }, c)));
}
const l1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])({
    user: null,
    session: null
}), R1 = (t)=>{
    const { supabaseClient: l } = t, [n, r] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null), [o, v] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])((n == null ? void 0 : n.user) ?? null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        (async ()=>{
            var d;
            const { data: w } = await l.auth.getSession();
            r(w.session), v(((d = w.session) == null ? void 0 : d.user) ?? null);
        })();
        const { data: C } = l.auth.onAuthStateChange(async (w, d)=>{
            r(d), v((d == null ? void 0 : d.user) ?? null);
        });
        return ()=>{
            C == null || C.subscription.unsubscribe();
        };
    }, []);
    const E = {
        session: n,
        user: o
    };
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(l1.Provider, {
        value: E,
        ...t
    });
}, O1 = ()=>{
    const t = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(l1);
    if (t === void 0) throw new Error("useUser must be used within a UserContextProvider.");
    return t;
};
function S({ supabaseClient: t, socialLayout: l = "vertical", providers: n, providerScopes: r, queryParams: o, view: v = "sign_in", redirectTo: E, onlyThirdPartyProviders: C = !1, magicLink: w = !1, showLinks: d = !0, appearance: i, theme: m = "default", localization: c = {
    variables: {}
}, otpType: y = "email", additionalData: x, children: a }) {
    const _ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["merge"])(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["en"], c.variables ?? {}), [h, g] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(v), [s, M] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), [p, B] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(""), P = h === "sign_in" || h === "sign_up" || h === "magic_link";
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        var z, f;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createStitches"])({
            theme: (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["merge"])(((z = i == null ? void 0 : i.theme) == null ? void 0 : z.default) ?? {}, ((f = i == null ? void 0 : i.variables) == null ? void 0 : f.default) ?? {})
        });
    }, [
        i
    ]);
    const A = ({ children: z })=>{
        var f;
        return(// @ts-ignore
        /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", {
            className: m !== "default" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createTheme"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["merge"])(// @ts-ignore
            i == null ? void 0 : i.theme[m], ((f = i == null ? void 0 : i.variables) == null ? void 0 : f[m]) ?? {})) : ""
        }, P && /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(A1, {
            appearance: i,
            supabaseClient: t,
            providers: n,
            providerScopes: r,
            queryParams: o,
            socialLayout: l,
            redirectTo: E,
            onlyThirdPartyProviders: C,
            i18n: _,
            view: h
        }), !C && z));
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const { data: z } = t.auth.onAuthStateChange((f)=>{
            f === "PASSWORD_RECOVERY" ? g("update_password") : f === "USER_UPDATED" && g("sign_in");
        });
        return g(v), ()=>z.subscription.unsubscribe();
    }, [
        v
    ]);
    const O = {
        supabaseClient: t,
        setAuthView: g,
        defaultEmail: s,
        defaultPassword: p,
        setDefaultEmail: M,
        setDefaultPassword: B,
        redirectTo: E,
        magicLink: w,
        showLinks: d,
        i18n: _,
        appearance: i
    };
    switch(h){
        case __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_IN:
            return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(A, null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(Q, {
                ...O,
                authView: "sign_in"
            }));
        case __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].SIGN_UP:
            return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(A, null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(Q, {
                appearance: i,
                supabaseClient: t,
                authView: "sign_up",
                setAuthView: g,
                defaultEmail: s,
                defaultPassword: p,
                setDefaultEmail: M,
                setDefaultPassword: B,
                redirectTo: E,
                magicLink: w,
                showLinks: d,
                i18n: _,
                additionalData: x,
                children: a
            }));
        case __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].FORGOTTEN_PASSWORD:
            return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(A, null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(e1, {
                appearance: i,
                supabaseClient: t,
                setAuthView: g,
                redirectTo: E,
                showLinks: d,
                i18n: _
            }));
        case __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].MAGIC_LINK:
            return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(A, null, /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(X, {
                appearance: i,
                supabaseClient: t,
                setAuthView: g,
                redirectTo: E,
                showLinks: d,
                i18n: _
            }));
        case __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].UPDATE_PASSWORD:
            return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(t1, {
                appearance: i,
                supabaseClient: t,
                i18n: _
            });
        case __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIEWS"].VERIFY_OTP:
            return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(U1, {
                appearance: i,
                supabaseClient: t,
                otpType: y,
                i18n: _
            });
        default:
            return null;
    }
}
S.ForgottenPassword = e1;
S.UpdatePassword = t1;
S.MagicLink = X;
S.UserContextProvider = R1;
S.useUser = O1;
const W1 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$stitches$2f$core$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["css"])({
    borderRadius: "12px",
    boxShadow: "rgba(100, 100, 111, 0.2) 0px 7px 29px 0px",
    width: "360px",
    padding: "28px 32px"
}), j1 = ({ children: t, appearance: l })=>{
    const n = [
        `${__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["PREPENDED_CLASS_NAMES"]}_ui-card`,
        W1(),
        l == null ? void 0 : l.className
    ];
    return /* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", {
        className: n.join(" ")
    }, t);
}, q1 = (t)=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(S, {
        showLinks: !1,
        ...t,
        onlyThirdPartyProviders: !1,
        view: "sign_up"
    }), K1 = (t)=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(S, {
        showLinks: !1,
        ...t,
        onlyThirdPartyProviders: !1,
        view: "sign_in"
    }), Y1 = (t)=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(S, {
        ...t,
        view: "magic_link",
        showLinks: !1
    }), J1 = (t)=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(S, {
        ...t,
        view: "sign_in",
        showLinks: !1,
        onlyThirdPartyProviders: !0
    }), Q1 = (t)=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(S, {
        showLinks: !1,
        ...t,
        view: "forgotten_password"
    }), X1 = (t)=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(S, {
        ...t,
        view: "update_password"
    }), e0 = (t)=>/* @__PURE__ */ __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(S, {
        ...t,
        view: "verify_otp"
    });
;
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-blur-svg.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * A shared function, used on both client and server, to generate a SVG blur placeholder.
 */ Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getImageBlurSvg", {
    enumerable: true,
    get: function() {
        return getImageBlurSvg;
    }
});
function getImageBlurSvg({ widthInt, heightInt, blurWidth, blurHeight, blurDataURL, objectFit }) {
    const std = 20;
    const svgWidth = blurWidth ? blurWidth * 40 : widthInt;
    const svgHeight = blurHeight ? blurHeight * 40 : heightInt;
    const viewBox = svgWidth && svgHeight ? `viewBox='0 0 ${svgWidth} ${svgHeight}'` : '';
    const preserveAspectRatio = viewBox ? 'none' : objectFit === 'contain' ? 'xMidYMid' : objectFit === 'cover' ? 'xMidYMid slice' : 'none';
    return `%3Csvg xmlns='http://www.w3.org/2000/svg' ${viewBox}%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='${std}'/%3E%3C/filter%3E%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='${preserveAspectRatio}' style='filter: url(%23b);' href='${blurDataURL}'/%3E%3C/svg%3E`;
} //# sourceMappingURL=image-blur-svg.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-config.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    VALID_LOADERS: null,
    imageConfigDefault: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    VALID_LOADERS: function() {
        return VALID_LOADERS;
    },
    imageConfigDefault: function() {
        return imageConfigDefault;
    }
});
const VALID_LOADERS = [
    'default',
    'imgix',
    'cloudinary',
    'akamai',
    'custom'
];
const imageConfigDefault = {
    deviceSizes: [
        640,
        750,
        828,
        1080,
        1200,
        1920,
        2048,
        3840
    ],
    imageSizes: [
        32,
        48,
        64,
        96,
        128,
        256,
        384
    ],
    path: '/_next/image',
    loader: 'default',
    loaderFile: '',
    /**
   * @deprecated Use `remotePatterns` instead to protect your application from malicious users.
   */ domains: [],
    disableStaticImages: false,
    minimumCacheTTL: 14400,
    formats: [
        'image/webp'
    ],
    maximumRedirects: 3,
    maximumResponseBody: 50000000,
    dangerouslyAllowLocalIP: false,
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: `script-src 'none'; frame-src 'none'; sandbox;`,
    contentDispositionType: 'attachment',
    localPatterns: undefined,
    remotePatterns: [],
    qualities: [
        75
    ],
    unoptimized: false
}; //# sourceMappingURL=image-config.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/get-img-props.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "getImgProps", {
    enumerable: true,
    get: function() {
        return getImgProps;
    }
});
const _warnonce = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/utils/warn-once.js [app-client] (ecmascript)");
const _deploymentid = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/deployment-id.js [app-client] (ecmascript)");
const _imageblursvg = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-blur-svg.js [app-client] (ecmascript)");
const _imageconfig = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-config.js [app-client] (ecmascript)");
const VALID_LOADING_VALUES = [
    'lazy',
    'eager',
    undefined
];
// Object-fit values that are not valid background-size values
const INVALID_BACKGROUND_SIZE_VALUES = [
    '-moz-initial',
    'fill',
    'none',
    'scale-down',
    undefined
];
function isStaticRequire(src) {
    return src.default !== undefined;
}
function isStaticImageData(src) {
    return src.src !== undefined;
}
function isStaticImport(src) {
    return !!src && typeof src === 'object' && (isStaticRequire(src) || isStaticImageData(src));
}
const allImgs = new Map();
let perfObserver;
function getInt(x) {
    if (typeof x === 'undefined') {
        return x;
    }
    if (typeof x === 'number') {
        return Number.isFinite(x) ? x : NaN;
    }
    if (typeof x === 'string' && /^[0-9]+$/.test(x)) {
        return parseInt(x, 10);
    }
    return NaN;
}
function getWidths({ deviceSizes, allSizes }, width, sizes) {
    if (sizes) {
        // Find all the "vw" percent sizes used in the sizes prop
        const viewportWidthRe = /(^|\s)(1?\d?\d)vw/g;
        const percentSizes = [];
        for(let match; match = viewportWidthRe.exec(sizes); match){
            percentSizes.push(parseInt(match[2]));
        }
        if (percentSizes.length) {
            const smallestRatio = Math.min(...percentSizes) * 0.01;
            return {
                widths: allSizes.filter((s)=>s >= deviceSizes[0] * smallestRatio),
                kind: 'w'
            };
        }
        return {
            widths: allSizes,
            kind: 'w'
        };
    }
    if (typeof width !== 'number') {
        return {
            widths: deviceSizes,
            kind: 'w'
        };
    }
    const widths = [
        ...new Set(// > are actually 3x in the green color, but only 1.5x in the red and
        // > blue colors. Showing a 3x resolution image in the app vs a 2x
        // > resolution image will be visually the same, though the 3x image
        // > takes significantly more data. Even true 3x resolution screens are
        // > wasteful as the human eye cannot see that level of detail without
        // > something like a magnifying glass.
        // https://blog.twitter.com/engineering/en_us/topics/infrastructure/2019/capping-image-fidelity-on-ultra-high-resolution-devices.html
        [
            width,
            width * 2 /*, width * 3*/ 
        ].map((w)=>allSizes.find((p)=>p >= w) || allSizes[allSizes.length - 1]))
    ];
    return {
        widths,
        kind: 'x'
    };
}
function generateImgAttrs({ config, src, unoptimized, width, quality, sizes, loader }) {
    if (unoptimized) {
        const deploymentId = (0, _deploymentid.getDeploymentId)();
        if (src.startsWith('/') && !src.startsWith('//') && deploymentId) {
            const sep = src.includes('?') ? '&' : '?';
            src = `${src}${sep}dpl=${deploymentId}`;
        }
        return {
            src,
            srcSet: undefined,
            sizes: undefined
        };
    }
    const { widths, kind } = getWidths(config, width, sizes);
    const last = widths.length - 1;
    return {
        sizes: !sizes && kind === 'w' ? '100vw' : sizes,
        srcSet: widths.map((w, i)=>`${loader({
                config,
                src,
                quality,
                width: w
            })} ${kind === 'w' ? w : i + 1}${kind}`).join(', '),
        // It's intended to keep `src` the last attribute because React updates
        // attributes in order. If we keep `src` the first one, Safari will
        // immediately start to fetch `src`, before `sizes` and `srcSet` are even
        // updated by React. That causes multiple unnecessary requests if `srcSet`
        // and `sizes` are defined.
        // This bug cannot be reproduced in Chrome or Firefox.
        src: loader({
            config,
            src,
            quality,
            width: widths[last]
        })
    };
}
function getImgProps({ src, sizes, unoptimized = false, priority = false, preload = false, loading, className, quality, width, height, fill = false, style, overrideSrc, onLoad, onLoadingComplete, placeholder = 'empty', blurDataURL, fetchPriority, decoding = 'async', layout, objectFit, objectPosition, lazyBoundary, lazyRoot, ...rest }, _state) {
    const { imgConf, showAltText, blurComplete, defaultLoader } = _state;
    let config;
    let c = imgConf || _imageconfig.imageConfigDefault;
    if ('allSizes' in c) {
        config = c;
    } else {
        const allSizes = [
            ...c.deviceSizes,
            ...c.imageSizes
        ].sort((a, b)=>a - b);
        const deviceSizes = c.deviceSizes.sort((a, b)=>a - b);
        const qualities = c.qualities?.sort((a, b)=>a - b);
        config = {
            ...c,
            allSizes,
            deviceSizes,
            qualities
        };
    }
    if (typeof defaultLoader === 'undefined') {
        throw Object.defineProperty(new Error('images.loaderFile detected but the file is missing default export.\nRead more: https://nextjs.org/docs/messages/invalid-images-config'), "__NEXT_ERROR_CODE", {
            value: "E163",
            enumerable: false,
            configurable: true
        });
    }
    let loader = rest.loader || defaultLoader;
    // Remove property so it's not spread on <img> element
    delete rest.loader;
    delete rest.srcSet;
    // This special value indicates that the user
    // didn't define a "loader" prop or "loader" config.
    const isDefaultLoader = '__next_img_default' in loader;
    if (isDefaultLoader) {
        if (config.loader === 'custom') {
            throw Object.defineProperty(new Error(`Image with src "${src}" is missing "loader" prop.` + `\nRead more: https://nextjs.org/docs/messages/next-image-missing-loader`), "__NEXT_ERROR_CODE", {
                value: "E252",
                enumerable: false,
                configurable: true
            });
        }
    } else {
        // The user defined a "loader" prop or config.
        // Since the config object is internal only, we
        // must not pass it to the user-defined "loader".
        const customImageLoader = loader;
        loader = (obj)=>{
            const { config: _, ...opts } = obj;
            return customImageLoader(opts);
        };
    }
    if (layout) {
        if (layout === 'fill') {
            fill = true;
        }
        const layoutToStyle = {
            intrinsic: {
                maxWidth: '100%',
                height: 'auto'
            },
            responsive: {
                width: '100%',
                height: 'auto'
            }
        };
        const layoutToSizes = {
            responsive: '100vw',
            fill: '100vw'
        };
        const layoutStyle = layoutToStyle[layout];
        if (layoutStyle) {
            style = {
                ...style,
                ...layoutStyle
            };
        }
        const layoutSizes = layoutToSizes[layout];
        if (layoutSizes && !sizes) {
            sizes = layoutSizes;
        }
    }
    let staticSrc = '';
    let widthInt = getInt(width);
    let heightInt = getInt(height);
    let blurWidth;
    let blurHeight;
    if (isStaticImport(src)) {
        const staticImageData = isStaticRequire(src) ? src.default : src;
        if (!staticImageData.src) {
            throw Object.defineProperty(new Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include src. Received ${JSON.stringify(staticImageData)}`), "__NEXT_ERROR_CODE", {
                value: "E460",
                enumerable: false,
                configurable: true
            });
        }
        if (!staticImageData.height || !staticImageData.width) {
            throw Object.defineProperty(new Error(`An object should only be passed to the image component src parameter if it comes from a static image import. It must include height and width. Received ${JSON.stringify(staticImageData)}`), "__NEXT_ERROR_CODE", {
                value: "E48",
                enumerable: false,
                configurable: true
            });
        }
        blurWidth = staticImageData.blurWidth;
        blurHeight = staticImageData.blurHeight;
        blurDataURL = blurDataURL || staticImageData.blurDataURL;
        staticSrc = staticImageData.src;
        if (!fill) {
            if (!widthInt && !heightInt) {
                widthInt = staticImageData.width;
                heightInt = staticImageData.height;
            } else if (widthInt && !heightInt) {
                const ratio = widthInt / staticImageData.width;
                heightInt = Math.round(staticImageData.height * ratio);
            } else if (!widthInt && heightInt) {
                const ratio = heightInt / staticImageData.height;
                widthInt = Math.round(staticImageData.width * ratio);
            }
        }
    }
    src = typeof src === 'string' ? src : staticSrc;
    let isLazy = !priority && !preload && (loading === 'lazy' || typeof loading === 'undefined');
    if (!src || src.startsWith('data:') || src.startsWith('blob:')) {
        // https://developer.mozilla.org/docs/Web/HTTP/Basics_of_HTTP/Data_URIs
        unoptimized = true;
        isLazy = false;
    }
    if (config.unoptimized) {
        unoptimized = true;
    }
    if (isDefaultLoader && !config.dangerouslyAllowSVG && src.split('?', 1)[0].endsWith('.svg')) {
        // Special case to make svg serve as-is to avoid proxying
        // through the built-in Image Optimization API.
        unoptimized = true;
    }
    const qualityInt = getInt(quality);
    if ("TURBOPACK compile-time truthy", 1) {
        if (config.output === 'export' && isDefaultLoader && !unoptimized) {
            throw Object.defineProperty(new Error(`Image Optimization using the default loader is not compatible with \`{ output: 'export' }\`.
  Possible solutions:
    - Remove \`{ output: 'export' }\` and run "next start" to run server mode including the Image Optimization API.
    - Configure \`{ images: { unoptimized: true } }\` in \`next.config.js\` to disable the Image Optimization API.
  Read more: https://nextjs.org/docs/messages/export-image-api`), "__NEXT_ERROR_CODE", {
                value: "E500",
                enumerable: false,
                configurable: true
            });
        }
        if (!src) {
            // React doesn't show the stack trace and there's
            // no `src` to help identify which image, so we
            // instead console.error(ref) during mount.
            unoptimized = true;
        } else {
            if (fill) {
                if (width) {
                    throw Object.defineProperty(new Error(`Image with src "${src}" has both "width" and "fill" properties. Only one should be used.`), "__NEXT_ERROR_CODE", {
                        value: "E96",
                        enumerable: false,
                        configurable: true
                    });
                }
                if (height) {
                    throw Object.defineProperty(new Error(`Image with src "${src}" has both "height" and "fill" properties. Only one should be used.`), "__NEXT_ERROR_CODE", {
                        value: "E115",
                        enumerable: false,
                        configurable: true
                    });
                }
                if (style?.position && style.position !== 'absolute') {
                    throw Object.defineProperty(new Error(`Image with src "${src}" has both "fill" and "style.position" properties. Images with "fill" always use position absolute - it cannot be modified.`), "__NEXT_ERROR_CODE", {
                        value: "E216",
                        enumerable: false,
                        configurable: true
                    });
                }
                if (style?.width && style.width !== '100%') {
                    throw Object.defineProperty(new Error(`Image with src "${src}" has both "fill" and "style.width" properties. Images with "fill" always use width 100% - it cannot be modified.`), "__NEXT_ERROR_CODE", {
                        value: "E73",
                        enumerable: false,
                        configurable: true
                    });
                }
                if (style?.height && style.height !== '100%') {
                    throw Object.defineProperty(new Error(`Image with src "${src}" has both "fill" and "style.height" properties. Images with "fill" always use height 100% - it cannot be modified.`), "__NEXT_ERROR_CODE", {
                        value: "E404",
                        enumerable: false,
                        configurable: true
                    });
                }
            } else {
                if (typeof widthInt === 'undefined') {
                    throw Object.defineProperty(new Error(`Image with src "${src}" is missing required "width" property.`), "__NEXT_ERROR_CODE", {
                        value: "E451",
                        enumerable: false,
                        configurable: true
                    });
                } else if (isNaN(widthInt)) {
                    throw Object.defineProperty(new Error(`Image with src "${src}" has invalid "width" property. Expected a numeric value in pixels but received "${width}".`), "__NEXT_ERROR_CODE", {
                        value: "E66",
                        enumerable: false,
                        configurable: true
                    });
                }
                if (typeof heightInt === 'undefined') {
                    throw Object.defineProperty(new Error(`Image with src "${src}" is missing required "height" property.`), "__NEXT_ERROR_CODE", {
                        value: "E397",
                        enumerable: false,
                        configurable: true
                    });
                } else if (isNaN(heightInt)) {
                    throw Object.defineProperty(new Error(`Image with src "${src}" has invalid "height" property. Expected a numeric value in pixels but received "${height}".`), "__NEXT_ERROR_CODE", {
                        value: "E444",
                        enumerable: false,
                        configurable: true
                    });
                }
                // eslint-disable-next-line no-control-regex
                if (/^[\x00-\x20]/.test(src)) {
                    throw Object.defineProperty(new Error(`Image with src "${src}" cannot start with a space or control character. Use src.trimStart() to remove it or encodeURIComponent(src) to keep it.`), "__NEXT_ERROR_CODE", {
                        value: "E176",
                        enumerable: false,
                        configurable: true
                    });
                }
                // eslint-disable-next-line no-control-regex
                if (/[\x00-\x20]$/.test(src)) {
                    throw Object.defineProperty(new Error(`Image with src "${src}" cannot end with a space or control character. Use src.trimEnd() to remove it or encodeURIComponent(src) to keep it.`), "__NEXT_ERROR_CODE", {
                        value: "E21",
                        enumerable: false,
                        configurable: true
                    });
                }
            }
        }
        if (!VALID_LOADING_VALUES.includes(loading)) {
            throw Object.defineProperty(new Error(`Image with src "${src}" has invalid "loading" property. Provided "${loading}" should be one of ${VALID_LOADING_VALUES.map(String).join(',')}.`), "__NEXT_ERROR_CODE", {
                value: "E357",
                enumerable: false,
                configurable: true
            });
        }
        if (priority && loading === 'lazy') {
            throw Object.defineProperty(new Error(`Image with src "${src}" has both "priority" and "loading='lazy'" properties. Only one should be used.`), "__NEXT_ERROR_CODE", {
                value: "E218",
                enumerable: false,
                configurable: true
            });
        }
        if (preload && loading === 'lazy') {
            throw Object.defineProperty(new Error(`Image with src "${src}" has both "preload" and "loading='lazy'" properties. Only one should be used.`), "__NEXT_ERROR_CODE", {
                value: "E803",
                enumerable: false,
                configurable: true
            });
        }
        if (preload && priority) {
            throw Object.defineProperty(new Error(`Image with src "${src}" has both "preload" and "priority" properties. Only "preload" should be used.`), "__NEXT_ERROR_CODE", {
                value: "E802",
                enumerable: false,
                configurable: true
            });
        }
        if (placeholder !== 'empty' && placeholder !== 'blur' && !placeholder.startsWith('data:image/')) {
            throw Object.defineProperty(new Error(`Image with src "${src}" has invalid "placeholder" property "${placeholder}".`), "__NEXT_ERROR_CODE", {
                value: "E431",
                enumerable: false,
                configurable: true
            });
        }
        if (placeholder !== 'empty') {
            if (widthInt && heightInt && widthInt * heightInt < 1600) {
                (0, _warnonce.warnOnce)(`Image with src "${src}" is smaller than 40x40. Consider removing the "placeholder" property to improve performance.`);
            }
        }
        if (qualityInt && config.qualities && !config.qualities.includes(qualityInt)) {
            (0, _warnonce.warnOnce)(`Image with src "${src}" is using quality "${qualityInt}" which is not configured in images.qualities [${config.qualities.join(', ')}]. Please update your config to [${[
                ...config.qualities,
                qualityInt
            ].sort().join(', ')}].` + `\nRead more: https://nextjs.org/docs/messages/next-image-unconfigured-qualities`);
        }
        if (placeholder === 'blur' && !blurDataURL) {
            const VALID_BLUR_EXT = [
                'jpeg',
                'png',
                'webp',
                'avif'
            ] // should match next-image-loader
            ;
            throw Object.defineProperty(new Error(`Image with src "${src}" has "placeholder='blur'" property but is missing the "blurDataURL" property.
        Possible solutions:
          - Add a "blurDataURL" property, the contents should be a small Data URL to represent the image
          - Change the "src" property to a static import with one of the supported file types: ${VALID_BLUR_EXT.join(',')} (animated images not supported)
          - Remove the "placeholder" property, effectively no blur effect
        Read more: https://nextjs.org/docs/messages/placeholder-blur-data-url`), "__NEXT_ERROR_CODE", {
                value: "E371",
                enumerable: false,
                configurable: true
            });
        }
        if ('ref' in rest) {
            (0, _warnonce.warnOnce)(`Image with src "${src}" is using unsupported "ref" property. Consider using the "onLoad" property instead.`);
        }
        if (!unoptimized && !isDefaultLoader) {
            const urlStr = loader({
                config,
                src,
                width: widthInt || 400,
                quality: qualityInt || 75
            });
            let url;
            try {
                url = new URL(urlStr);
            } catch (err) {}
            if (urlStr === src || url && url.pathname === src && !url.search) {
                (0, _warnonce.warnOnce)(`Image with src "${src}" has a "loader" property that does not implement width. Please implement it or use the "unoptimized" property instead.` + `\nRead more: https://nextjs.org/docs/messages/next-image-missing-loader-width`);
            }
        }
        if (onLoadingComplete) {
            (0, _warnonce.warnOnce)(`Image with src "${src}" is using deprecated "onLoadingComplete" property. Please use the "onLoad" property instead.`);
        }
        for (const [legacyKey, legacyValue] of Object.entries({
            layout,
            objectFit,
            objectPosition,
            lazyBoundary,
            lazyRoot
        })){
            if (legacyValue) {
                (0, _warnonce.warnOnce)(`Image with src "${src}" has legacy prop "${legacyKey}". Did you forget to run the codemod?` + `\nRead more: https://nextjs.org/docs/messages/next-image-upgrade-to-13`);
            }
        }
        if (typeof window !== 'undefined' && !perfObserver && window.PerformanceObserver) {
            perfObserver = new PerformanceObserver((entryList)=>{
                for (const entry of entryList.getEntries()){
                    // @ts-ignore - missing "LargestContentfulPaint" class with "element" prop
                    const imgSrc = entry?.element?.src || '';
                    const lcpImage = allImgs.get(imgSrc);
                    if (lcpImage && lcpImage.loading === 'lazy' && lcpImage.placeholder === 'empty' && !lcpImage.src.startsWith('data:') && !lcpImage.src.startsWith('blob:')) {
                        // https://web.dev/lcp/#measure-lcp-in-javascript
                        (0, _warnonce.warnOnce)(`Image with src "${lcpImage.src}" was detected as the Largest Contentful Paint (LCP). Please add the \`loading="eager"\` property if this image is above the fold.` + `\nRead more: https://nextjs.org/docs/app/api-reference/components/image#loading`);
                    }
                }
            });
            try {
                perfObserver.observe({
                    type: 'largest-contentful-paint',
                    buffered: true
                });
            } catch (err) {
                // Log error but don't crash the app
                console.error(err);
            }
        }
    }
    const imgStyle = Object.assign(fill ? {
        position: 'absolute',
        height: '100%',
        width: '100%',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        objectFit,
        objectPosition
    } : {}, showAltText ? {} : {
        color: 'transparent'
    }, style);
    const backgroundImage = !blurComplete && placeholder !== 'empty' ? placeholder === 'blur' ? `url("data:image/svg+xml;charset=utf-8,${(0, _imageblursvg.getImageBlurSvg)({
        widthInt,
        heightInt,
        blurWidth,
        blurHeight,
        blurDataURL: blurDataURL || '',
        objectFit: imgStyle.objectFit
    })}")` : `url("${placeholder}")` // assume `data:image/`
     : null;
    const backgroundSize = !INVALID_BACKGROUND_SIZE_VALUES.includes(imgStyle.objectFit) ? imgStyle.objectFit : imgStyle.objectFit === 'fill' ? '100% 100%' // the background-size equivalent of `fill`
     : 'cover';
    let placeholderStyle = backgroundImage ? {
        backgroundSize,
        backgroundPosition: imgStyle.objectPosition || '50% 50%',
        backgroundRepeat: 'no-repeat',
        backgroundImage
    } : {};
    if ("TURBOPACK compile-time truthy", 1) {
        if (placeholderStyle.backgroundImage && placeholder === 'blur' && blurDataURL?.startsWith('/')) {
            // During `next dev`, we don't want to generate blur placeholders with webpack
            // because it can delay starting the dev server. Instead, `next-image-loader.js`
            // will inline a special url to lazily generate the blur placeholder at request time.
            placeholderStyle.backgroundImage = `url("${blurDataURL}")`;
        }
    }
    const imgAttributes = generateImgAttrs({
        config,
        src,
        unoptimized,
        width: widthInt,
        quality: qualityInt,
        sizes,
        loader
    });
    const loadingFinal = isLazy ? 'lazy' : loading;
    if ("TURBOPACK compile-time truthy", 1) {
        if (typeof window !== 'undefined') {
            let fullUrl;
            try {
                fullUrl = new URL(imgAttributes.src);
            } catch (e) {
                fullUrl = new URL(imgAttributes.src, window.location.href);
            }
            allImgs.set(fullUrl.href, {
                src,
                loading: loadingFinal,
                placeholder
            });
        }
    }
    const props = {
        ...rest,
        loading: loadingFinal,
        fetchPriority,
        width: widthInt,
        height: heightInt,
        decoding,
        className,
        style: {
            ...imgStyle,
            ...placeholderStyle
        },
        sizes: imgAttributes.sizes,
        srcSet: imgAttributes.srcSet,
        src: overrideSrc || imgAttributes.src
    };
    const meta = {
        unoptimized,
        preload: preload || priority,
        placeholder,
        fill
    };
    return {
        props,
        meta
    };
} //# sourceMappingURL=get-img-props.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/side-effect.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return SideEffect;
    }
});
const _react = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
const isServer = typeof window === 'undefined';
const useClientOnlyLayoutEffect = isServer ? ()=>{} : _react.useLayoutEffect;
const useClientOnlyEffect = isServer ? ()=>{} : _react.useEffect;
function SideEffect(props) {
    const { headManager, reduceComponentsToState } = props;
    function emitChange() {
        if (headManager && headManager.mountedInstances) {
            const headElements = _react.Children.toArray(Array.from(headManager.mountedInstances).filter(Boolean));
            headManager.updateHead(reduceComponentsToState(headElements));
        }
    }
    if (isServer) {
        headManager?.mountedInstances?.add(props.children);
        emitChange();
    }
    useClientOnlyLayoutEffect({
        "SideEffect.useClientOnlyLayoutEffect": ()=>{
            headManager?.mountedInstances?.add(props.children);
            return ({
                "SideEffect.useClientOnlyLayoutEffect": ()=>{
                    headManager?.mountedInstances?.delete(props.children);
                }
            })["SideEffect.useClientOnlyLayoutEffect"];
        }
    }["SideEffect.useClientOnlyLayoutEffect"]);
    // We need to call `updateHead` method whenever the `SideEffect` is trigger in all
    // life-cycles: mount, update, unmount. However, if there are multiple `SideEffect`s
    // being rendered, we only trigger the method from the last one.
    // This is ensured by keeping the last unflushed `updateHead` in the `_pendingUpdate`
    // singleton in the layout effect pass, and actually trigger it in the effect pass.
    useClientOnlyLayoutEffect({
        "SideEffect.useClientOnlyLayoutEffect": ()=>{
            if (headManager) {
                headManager._pendingUpdate = emitChange;
            }
            return ({
                "SideEffect.useClientOnlyLayoutEffect": ()=>{
                    if (headManager) {
                        headManager._pendingUpdate = emitChange;
                    }
                }
            })["SideEffect.useClientOnlyLayoutEffect"];
        }
    }["SideEffect.useClientOnlyLayoutEffect"]);
    useClientOnlyEffect({
        "SideEffect.useClientOnlyEffect": ()=>{
            if (headManager && headManager._pendingUpdate) {
                headManager._pendingUpdate();
                headManager._pendingUpdate = null;
            }
            return ({
                "SideEffect.useClientOnlyEffect": ()=>{
                    if (headManager && headManager._pendingUpdate) {
                        headManager._pendingUpdate();
                        headManager._pendingUpdate = null;
                    }
                }
            })["SideEffect.useClientOnlyEffect"];
        }
    }["SideEffect.useClientOnlyEffect"]);
    return null;
} //# sourceMappingURL=side-effect.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/head.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    default: null,
    defaultHead: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    default: function() {
        return _default;
    },
    defaultHead: function() {
        return defaultHead;
    }
});
const _interop_require_default = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _interop_require_wildcard = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _sideeffect = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/side-effect.js [app-client] (ecmascript)"));
const _headmanagercontextsharedruntime = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/head-manager-context.shared-runtime.js [app-client] (ecmascript)");
const _warnonce = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/utils/warn-once.js [app-client] (ecmascript)");
function defaultHead() {
    const head = [
        /*#__PURE__*/ (0, _jsxruntime.jsx)("meta", {
            charSet: "utf-8"
        }, "charset"),
        /*#__PURE__*/ (0, _jsxruntime.jsx)("meta", {
            name: "viewport",
            content: "width=device-width"
        }, "viewport")
    ];
    return head;
}
function onlyReactElement(list, child) {
    // React children can be "string" or "number" in this case we ignore them for backwards compat
    if (typeof child === 'string' || typeof child === 'number') {
        return list;
    }
    // Adds support for React.Fragment
    if (child.type === _react.default.Fragment) {
        return list.concat(_react.default.Children.toArray(child.props.children).reduce((fragmentList, fragmentChild)=>{
            if (typeof fragmentChild === 'string' || typeof fragmentChild === 'number') {
                return fragmentList;
            }
            return fragmentList.concat(fragmentChild);
        }, []));
    }
    return list.concat(child);
}
const METATYPES = [
    'name',
    'httpEquiv',
    'charSet',
    'itemProp'
];
/*
 returns a function for filtering head child elements
 which shouldn't be duplicated, like <title/>
 Also adds support for deduplicated `key` properties
*/ function unique() {
    const keys = new Set();
    const tags = new Set();
    const metaTypes = new Set();
    const metaCategories = {};
    return (h)=>{
        let isUnique = true;
        let hasKey = false;
        if (h.key && typeof h.key !== 'number' && h.key.indexOf('$') > 0) {
            hasKey = true;
            const key = h.key.slice(h.key.indexOf('$') + 1);
            if (keys.has(key)) {
                isUnique = false;
            } else {
                keys.add(key);
            }
        }
        // eslint-disable-next-line default-case
        switch(h.type){
            case 'title':
            case 'base':
                if (tags.has(h.type)) {
                    isUnique = false;
                } else {
                    tags.add(h.type);
                }
                break;
            case 'meta':
                for(let i = 0, len = METATYPES.length; i < len; i++){
                    const metatype = METATYPES[i];
                    if (!h.props.hasOwnProperty(metatype)) continue;
                    if (metatype === 'charSet') {
                        if (metaTypes.has(metatype)) {
                            isUnique = false;
                        } else {
                            metaTypes.add(metatype);
                        }
                    } else {
                        const category = h.props[metatype];
                        const categories = metaCategories[metatype] || new Set();
                        if ((metatype !== 'name' || !hasKey) && categories.has(category)) {
                            isUnique = false;
                        } else {
                            categories.add(category);
                            metaCategories[metatype] = categories;
                        }
                    }
                }
                break;
        }
        return isUnique;
    };
}
/**
 *
 * @param headChildrenElements List of children of <Head>
 */ function reduceComponents(headChildrenElements) {
    return headChildrenElements.reduce(onlyReactElement, []).reverse().concat(defaultHead().reverse()).filter(unique()).reverse().map((c, i)=>{
        const key = c.key || i;
        if ("TURBOPACK compile-time truthy", 1) {
            // omit JSON-LD structured data snippets from the warning
            if (c.type === 'script' && c.props['type'] !== 'application/ld+json') {
                const srcMessage = c.props['src'] ? `<script> tag with src="${c.props['src']}"` : `inline <script>`;
                (0, _warnonce.warnOnce)(`Do not add <script> tags using next/head (see ${srcMessage}). Use next/script instead. \nSee more info here: https://nextjs.org/docs/messages/no-script-tags-in-head-component`);
            } else if (c.type === 'link' && c.props['rel'] === 'stylesheet') {
                (0, _warnonce.warnOnce)(`Do not add stylesheets using next/head (see <link rel="stylesheet"> tag with href="${c.props['href']}"). Use Document instead. \nSee more info here: https://nextjs.org/docs/messages/no-stylesheets-in-head-component`);
            }
        }
        return /*#__PURE__*/ _react.default.cloneElement(c, {
            key
        });
    });
}
/**
 * This component injects elements to `<head>` of your page.
 * To avoid duplicated `tags` in `<head>` you can use the `key` property, which will make sure every tag is only rendered once.
 */ function Head({ children }) {
    const headManager = (0, _react.useContext)(_headmanagercontextsharedruntime.HeadManagerContext);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_sideeffect.default, {
        reduceComponentsToState: reduceComponents,
        headManager: headManager,
        children: children
    });
}
const _default = Head;
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=head.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-config-context.shared-runtime.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ImageConfigContext", {
    enumerable: true,
    get: function() {
        return ImageConfigContext;
    }
});
const _interop_require_default = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _imageconfig = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-config.js [app-client] (ecmascript)");
const ImageConfigContext = _react.default.createContext(_imageconfig.imageConfigDefault);
if ("TURBOPACK compile-time truthy", 1) {
    ImageConfigContext.displayName = 'ImageConfigContext';
} //# sourceMappingURL=image-config-context.shared-runtime.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/router-context.shared-runtime.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RouterContext", {
    enumerable: true,
    get: function() {
        return RouterContext;
    }
});
const _interop_require_default = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const RouterContext = _react.default.createContext(null);
if ("TURBOPACK compile-time truthy", 1) {
    RouterContext.displayName = 'RouterContext';
} //# sourceMappingURL=router-context.shared-runtime.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/find-closest-quality.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "findClosestQuality", {
    enumerable: true,
    get: function() {
        return findClosestQuality;
    }
});
function findClosestQuality(quality, config) {
    const q = quality || 75;
    if (!config?.qualities?.length) {
        return q;
    }
    return config.qualities.reduce((prev, cur)=>Math.abs(cur - q) < Math.abs(prev - q) ? cur : prev, 0);
} //# sourceMappingURL=find-closest-quality.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/compiled/picomatch/index.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
(()=>{
    "use strict";
    var t = {
        170: (t, e, u)=>{
            const n = u(510);
            const isWindows = ()=>{
                if (typeof navigator !== "undefined" && navigator.platform) {
                    const t = navigator.platform.toLowerCase();
                    return t === "win32" || t === "windows";
                }
                if (typeof __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"] !== "undefined" && __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].platform) {
                    return __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].platform === "win32";
                }
                return false;
            };
            function picomatch(t, e, u = false) {
                if (e && (e.windows === null || e.windows === undefined)) {
                    e = {
                        ...e,
                        windows: isWindows()
                    };
                }
                return n(t, e, u);
            }
            Object.assign(picomatch, n);
            t.exports = picomatch;
        },
        154: (t)=>{
            const e = "\\\\/";
            const u = `[^${e}]`;
            const n = "\\.";
            const o = "\\+";
            const s = "\\?";
            const r = "\\/";
            const a = "(?=.)";
            const i = "[^/]";
            const c = `(?:${r}|$)`;
            const p = `(?:^|${r})`;
            const l = `${n}{1,2}${c}`;
            const f = `(?!${n})`;
            const A = `(?!${p}${l})`;
            const _ = `(?!${n}{0,1}${c})`;
            const R = `(?!${l})`;
            const E = `[^.${r}]`;
            const h = `${i}*?`;
            const g = "/";
            const b = {
                DOT_LITERAL: n,
                PLUS_LITERAL: o,
                QMARK_LITERAL: s,
                SLASH_LITERAL: r,
                ONE_CHAR: a,
                QMARK: i,
                END_ANCHOR: c,
                DOTS_SLASH: l,
                NO_DOT: f,
                NO_DOTS: A,
                NO_DOT_SLASH: _,
                NO_DOTS_SLASH: R,
                QMARK_NO_DOT: E,
                STAR: h,
                START_ANCHOR: p,
                SEP: g
            };
            const C = {
                ...b,
                SLASH_LITERAL: `[${e}]`,
                QMARK: u,
                STAR: `${u}*?`,
                DOTS_SLASH: `${n}{1,2}(?:[${e}]|$)`,
                NO_DOT: `(?!${n})`,
                NO_DOTS: `(?!(?:^|[${e}])${n}{1,2}(?:[${e}]|$))`,
                NO_DOT_SLASH: `(?!${n}{0,1}(?:[${e}]|$))`,
                NO_DOTS_SLASH: `(?!${n}{1,2}(?:[${e}]|$))`,
                QMARK_NO_DOT: `[^.${e}]`,
                START_ANCHOR: `(?:^|[${e}])`,
                END_ANCHOR: `(?:[${e}]|$)`,
                SEP: "\\"
            };
            const y = {
                alnum: "a-zA-Z0-9",
                alpha: "a-zA-Z",
                ascii: "\\x00-\\x7F",
                blank: " \\t",
                cntrl: "\\x00-\\x1F\\x7F",
                digit: "0-9",
                graph: "\\x21-\\x7E",
                lower: "a-z",
                print: "\\x20-\\x7E ",
                punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
                space: " \\t\\r\\n\\v\\f",
                upper: "A-Z",
                word: "A-Za-z0-9_",
                xdigit: "A-Fa-f0-9"
            };
            t.exports = {
                MAX_LENGTH: 1024 * 64,
                POSIX_REGEX_SOURCE: y,
                REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
                REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
                REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
                REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
                REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
                REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
                REPLACEMENTS: {
                    "***": "*",
                    "**/**": "**",
                    "**/**/**": "**"
                },
                CHAR_0: 48,
                CHAR_9: 57,
                CHAR_UPPERCASE_A: 65,
                CHAR_LOWERCASE_A: 97,
                CHAR_UPPERCASE_Z: 90,
                CHAR_LOWERCASE_Z: 122,
                CHAR_LEFT_PARENTHESES: 40,
                CHAR_RIGHT_PARENTHESES: 41,
                CHAR_ASTERISK: 42,
                CHAR_AMPERSAND: 38,
                CHAR_AT: 64,
                CHAR_BACKWARD_SLASH: 92,
                CHAR_CARRIAGE_RETURN: 13,
                CHAR_CIRCUMFLEX_ACCENT: 94,
                CHAR_COLON: 58,
                CHAR_COMMA: 44,
                CHAR_DOT: 46,
                CHAR_DOUBLE_QUOTE: 34,
                CHAR_EQUAL: 61,
                CHAR_EXCLAMATION_MARK: 33,
                CHAR_FORM_FEED: 12,
                CHAR_FORWARD_SLASH: 47,
                CHAR_GRAVE_ACCENT: 96,
                CHAR_HASH: 35,
                CHAR_HYPHEN_MINUS: 45,
                CHAR_LEFT_ANGLE_BRACKET: 60,
                CHAR_LEFT_CURLY_BRACE: 123,
                CHAR_LEFT_SQUARE_BRACKET: 91,
                CHAR_LINE_FEED: 10,
                CHAR_NO_BREAK_SPACE: 160,
                CHAR_PERCENT: 37,
                CHAR_PLUS: 43,
                CHAR_QUESTION_MARK: 63,
                CHAR_RIGHT_ANGLE_BRACKET: 62,
                CHAR_RIGHT_CURLY_BRACE: 125,
                CHAR_RIGHT_SQUARE_BRACKET: 93,
                CHAR_SEMICOLON: 59,
                CHAR_SINGLE_QUOTE: 39,
                CHAR_SPACE: 32,
                CHAR_TAB: 9,
                CHAR_UNDERSCORE: 95,
                CHAR_VERTICAL_LINE: 124,
                CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
                extglobChars (t) {
                    return {
                        "!": {
                            type: "negate",
                            open: "(?:(?!(?:",
                            close: `))${t.STAR})`
                        },
                        "?": {
                            type: "qmark",
                            open: "(?:",
                            close: ")?"
                        },
                        "+": {
                            type: "plus",
                            open: "(?:",
                            close: ")+"
                        },
                        "*": {
                            type: "star",
                            open: "(?:",
                            close: ")*"
                        },
                        "@": {
                            type: "at",
                            open: "(?:",
                            close: ")"
                        }
                    };
                },
                globChars (t) {
                    return t === true ? C : b;
                }
            };
        },
        697: (t, e, u)=>{
            const n = u(154);
            const o = u(96);
            const { MAX_LENGTH: s, POSIX_REGEX_SOURCE: r, REGEX_NON_SPECIAL_CHARS: a, REGEX_SPECIAL_CHARS_BACKREF: i, REPLACEMENTS: c } = n;
            const expandRange = (t, e)=>{
                if (typeof e.expandRange === "function") {
                    return e.expandRange(...t, e);
                }
                t.sort();
                const u = `[${t.join("-")}]`;
                try {
                    new RegExp(u);
                } catch (e) {
                    return t.map((t)=>o.escapeRegex(t)).join("..");
                }
                return u;
            };
            const syntaxError = (t, e)=>`Missing ${t}: "${e}" - use "\\\\${e}" to match literal characters`;
            const parse = (t, e)=>{
                if (typeof t !== "string") {
                    throw new TypeError("Expected a string");
                }
                t = c[t] || t;
                const u = {
                    ...e
                };
                const p = typeof u.maxLength === "number" ? Math.min(s, u.maxLength) : s;
                let l = t.length;
                if (l > p) {
                    throw new SyntaxError(`Input length: ${l}, exceeds maximum allowed length: ${p}`);
                }
                const f = {
                    type: "bos",
                    value: "",
                    output: u.prepend || ""
                };
                const A = [
                    f
                ];
                const _ = u.capture ? "" : "?:";
                const R = n.globChars(u.windows);
                const E = n.extglobChars(R);
                const { DOT_LITERAL: h, PLUS_LITERAL: g, SLASH_LITERAL: b, ONE_CHAR: C, DOTS_SLASH: y, NO_DOT: $, NO_DOT_SLASH: x, NO_DOTS_SLASH: S, QMARK: H, QMARK_NO_DOT: v, STAR: d, START_ANCHOR: L } = R;
                const globstar = (t)=>`(${_}(?:(?!${L}${t.dot ? y : h}).)*?)`;
                const T = u.dot ? "" : $;
                const O = u.dot ? H : v;
                let k = u.bash === true ? globstar(u) : d;
                if (u.capture) {
                    k = `(${k})`;
                }
                if (typeof u.noext === "boolean") {
                    u.noextglob = u.noext;
                }
                const m = {
                    input: t,
                    index: -1,
                    start: 0,
                    dot: u.dot === true,
                    consumed: "",
                    output: "",
                    prefix: "",
                    backtrack: false,
                    negated: false,
                    brackets: 0,
                    braces: 0,
                    parens: 0,
                    quotes: 0,
                    globstar: false,
                    tokens: A
                };
                t = o.removePrefix(t, m);
                l = t.length;
                const w = [];
                const N = [];
                const I = [];
                let B = f;
                let G;
                const eos = ()=>m.index === l - 1;
                const D = m.peek = (e = 1)=>t[m.index + e];
                const M = m.advance = ()=>t[++m.index] || "";
                const remaining = ()=>t.slice(m.index + 1);
                const consume = (t = "", e = 0)=>{
                    m.consumed += t;
                    m.index += e;
                };
                const append = (t)=>{
                    m.output += t.output != null ? t.output : t.value;
                    consume(t.value);
                };
                const negate = ()=>{
                    let t = 1;
                    while(D() === "!" && (D(2) !== "(" || D(3) === "?")){
                        M();
                        m.start++;
                        t++;
                    }
                    if (t % 2 === 0) {
                        return false;
                    }
                    m.negated = true;
                    m.start++;
                    return true;
                };
                const increment = (t)=>{
                    m[t]++;
                    I.push(t);
                };
                const decrement = (t)=>{
                    m[t]--;
                    I.pop();
                };
                const push = (t)=>{
                    if (B.type === "globstar") {
                        const e = m.braces > 0 && (t.type === "comma" || t.type === "brace");
                        const u = t.extglob === true || w.length && (t.type === "pipe" || t.type === "paren");
                        if (t.type !== "slash" && t.type !== "paren" && !e && !u) {
                            m.output = m.output.slice(0, -B.output.length);
                            B.type = "star";
                            B.value = "*";
                            B.output = k;
                            m.output += B.output;
                        }
                    }
                    if (w.length && t.type !== "paren") {
                        w[w.length - 1].inner += t.value;
                    }
                    if (t.value || t.output) append(t);
                    if (B && B.type === "text" && t.type === "text") {
                        B.output = (B.output || B.value) + t.value;
                        B.value += t.value;
                        return;
                    }
                    t.prev = B;
                    A.push(t);
                    B = t;
                };
                const extglobOpen = (t, e)=>{
                    const n = {
                        ...E[e],
                        conditions: 1,
                        inner: ""
                    };
                    n.prev = B;
                    n.parens = m.parens;
                    n.output = m.output;
                    const o = (u.capture ? "(" : "") + n.open;
                    increment("parens");
                    push({
                        type: t,
                        value: e,
                        output: m.output ? "" : C
                    });
                    push({
                        type: "paren",
                        extglob: true,
                        value: M(),
                        output: o
                    });
                    w.push(n);
                };
                const extglobClose = (t)=>{
                    let n = t.close + (u.capture ? ")" : "");
                    let o;
                    if (t.type === "negate") {
                        let s = k;
                        if (t.inner && t.inner.length > 1 && t.inner.includes("/")) {
                            s = globstar(u);
                        }
                        if (s !== k || eos() || /^\)+$/.test(remaining())) {
                            n = t.close = `)$))${s}`;
                        }
                        if (t.inner.includes("*") && (o = remaining()) && /^\.[^\\/.]+$/.test(o)) {
                            const u = parse(o, {
                                ...e,
                                fastpaths: false
                            }).output;
                            n = t.close = `)${u})${s})`;
                        }
                        if (t.prev.type === "bos") {
                            m.negatedExtglob = true;
                        }
                    }
                    push({
                        type: "paren",
                        extglob: true,
                        value: G,
                        output: n
                    });
                    decrement("parens");
                };
                if (u.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(t)) {
                    let n = false;
                    let s = t.replace(i, (t, e, u, o, s, r)=>{
                        if (o === "\\") {
                            n = true;
                            return t;
                        }
                        if (o === "?") {
                            if (e) {
                                return e + o + (s ? H.repeat(s.length) : "");
                            }
                            if (r === 0) {
                                return O + (s ? H.repeat(s.length) : "");
                            }
                            return H.repeat(u.length);
                        }
                        if (o === ".") {
                            return h.repeat(u.length);
                        }
                        if (o === "*") {
                            if (e) {
                                return e + o + (s ? k : "");
                            }
                            return k;
                        }
                        return e ? t : `\\${t}`;
                    });
                    if (n === true) {
                        if (u.unescape === true) {
                            s = s.replace(/\\/g, "");
                        } else {
                            s = s.replace(/\\+/g, (t)=>t.length % 2 === 0 ? "\\\\" : t ? "\\" : "");
                        }
                    }
                    if (s === t && u.contains === true) {
                        m.output = t;
                        return m;
                    }
                    m.output = o.wrapOutput(s, m, e);
                    return m;
                }
                while(!eos()){
                    G = M();
                    if (G === "\0") {
                        continue;
                    }
                    if (G === "\\") {
                        const t = D();
                        if (t === "/" && u.bash !== true) {
                            continue;
                        }
                        if (t === "." || t === ";") {
                            continue;
                        }
                        if (!t) {
                            G += "\\";
                            push({
                                type: "text",
                                value: G
                            });
                            continue;
                        }
                        const e = /^\\+/.exec(remaining());
                        let n = 0;
                        if (e && e[0].length > 2) {
                            n = e[0].length;
                            m.index += n;
                            if (n % 2 !== 0) {
                                G += "\\";
                            }
                        }
                        if (u.unescape === true) {
                            G = M();
                        } else {
                            G += M();
                        }
                        if (m.brackets === 0) {
                            push({
                                type: "text",
                                value: G
                            });
                            continue;
                        }
                    }
                    if (m.brackets > 0 && (G !== "]" || B.value === "[" || B.value === "[^")) {
                        if (u.posix !== false && G === ":") {
                            const t = B.value.slice(1);
                            if (t.includes("[")) {
                                B.posix = true;
                                if (t.includes(":")) {
                                    const t = B.value.lastIndexOf("[");
                                    const e = B.value.slice(0, t);
                                    const u = B.value.slice(t + 2);
                                    const n = r[u];
                                    if (n) {
                                        B.value = e + n;
                                        m.backtrack = true;
                                        M();
                                        if (!f.output && A.indexOf(B) === 1) {
                                            f.output = C;
                                        }
                                        continue;
                                    }
                                }
                            }
                        }
                        if (G === "[" && D() !== ":" || G === "-" && D() === "]") {
                            G = `\\${G}`;
                        }
                        if (G === "]" && (B.value === "[" || B.value === "[^")) {
                            G = `\\${G}`;
                        }
                        if (u.posix === true && G === "!" && B.value === "[") {
                            G = "^";
                        }
                        B.value += G;
                        append({
                            value: G
                        });
                        continue;
                    }
                    if (m.quotes === 1 && G !== '"') {
                        G = o.escapeRegex(G);
                        B.value += G;
                        append({
                            value: G
                        });
                        continue;
                    }
                    if (G === '"') {
                        m.quotes = m.quotes === 1 ? 0 : 1;
                        if (u.keepQuotes === true) {
                            push({
                                type: "text",
                                value: G
                            });
                        }
                        continue;
                    }
                    if (G === "(") {
                        increment("parens");
                        push({
                            type: "paren",
                            value: G
                        });
                        continue;
                    }
                    if (G === ")") {
                        if (m.parens === 0 && u.strictBrackets === true) {
                            throw new SyntaxError(syntaxError("opening", "("));
                        }
                        const t = w[w.length - 1];
                        if (t && m.parens === t.parens + 1) {
                            extglobClose(w.pop());
                            continue;
                        }
                        push({
                            type: "paren",
                            value: G,
                            output: m.parens ? ")" : "\\)"
                        });
                        decrement("parens");
                        continue;
                    }
                    if (G === "[") {
                        if (u.nobracket === true || !remaining().includes("]")) {
                            if (u.nobracket !== true && u.strictBrackets === true) {
                                throw new SyntaxError(syntaxError("closing", "]"));
                            }
                            G = `\\${G}`;
                        } else {
                            increment("brackets");
                        }
                        push({
                            type: "bracket",
                            value: G
                        });
                        continue;
                    }
                    if (G === "]") {
                        if (u.nobracket === true || B && B.type === "bracket" && B.value.length === 1) {
                            push({
                                type: "text",
                                value: G,
                                output: `\\${G}`
                            });
                            continue;
                        }
                        if (m.brackets === 0) {
                            if (u.strictBrackets === true) {
                                throw new SyntaxError(syntaxError("opening", "["));
                            }
                            push({
                                type: "text",
                                value: G,
                                output: `\\${G}`
                            });
                            continue;
                        }
                        decrement("brackets");
                        const t = B.value.slice(1);
                        if (B.posix !== true && t[0] === "^" && !t.includes("/")) {
                            G = `/${G}`;
                        }
                        B.value += G;
                        append({
                            value: G
                        });
                        if (u.literalBrackets === false || o.hasRegexChars(t)) {
                            continue;
                        }
                        const e = o.escapeRegex(B.value);
                        m.output = m.output.slice(0, -B.value.length);
                        if (u.literalBrackets === true) {
                            m.output += e;
                            B.value = e;
                            continue;
                        }
                        B.value = `(${_}${e}|${B.value})`;
                        m.output += B.value;
                        continue;
                    }
                    if (G === "{" && u.nobrace !== true) {
                        increment("braces");
                        const t = {
                            type: "brace",
                            value: G,
                            output: "(",
                            outputIndex: m.output.length,
                            tokensIndex: m.tokens.length
                        };
                        N.push(t);
                        push(t);
                        continue;
                    }
                    if (G === "}") {
                        const t = N[N.length - 1];
                        if (u.nobrace === true || !t) {
                            push({
                                type: "text",
                                value: G,
                                output: G
                            });
                            continue;
                        }
                        let e = ")";
                        if (t.dots === true) {
                            const t = A.slice();
                            const n = [];
                            for(let e = t.length - 1; e >= 0; e--){
                                A.pop();
                                if (t[e].type === "brace") {
                                    break;
                                }
                                if (t[e].type !== "dots") {
                                    n.unshift(t[e].value);
                                }
                            }
                            e = expandRange(n, u);
                            m.backtrack = true;
                        }
                        if (t.comma !== true && t.dots !== true) {
                            const u = m.output.slice(0, t.outputIndex);
                            const n = m.tokens.slice(t.tokensIndex);
                            t.value = t.output = "\\{";
                            G = e = "\\}";
                            m.output = u;
                            for (const t of n){
                                m.output += t.output || t.value;
                            }
                        }
                        push({
                            type: "brace",
                            value: G,
                            output: e
                        });
                        decrement("braces");
                        N.pop();
                        continue;
                    }
                    if (G === "|") {
                        if (w.length > 0) {
                            w[w.length - 1].conditions++;
                        }
                        push({
                            type: "text",
                            value: G
                        });
                        continue;
                    }
                    if (G === ",") {
                        let t = G;
                        const e = N[N.length - 1];
                        if (e && I[I.length - 1] === "braces") {
                            e.comma = true;
                            t = "|";
                        }
                        push({
                            type: "comma",
                            value: G,
                            output: t
                        });
                        continue;
                    }
                    if (G === "/") {
                        if (B.type === "dot" && m.index === m.start + 1) {
                            m.start = m.index + 1;
                            m.consumed = "";
                            m.output = "";
                            A.pop();
                            B = f;
                            continue;
                        }
                        push({
                            type: "slash",
                            value: G,
                            output: b
                        });
                        continue;
                    }
                    if (G === ".") {
                        if (m.braces > 0 && B.type === "dot") {
                            if (B.value === ".") B.output = h;
                            const t = N[N.length - 1];
                            B.type = "dots";
                            B.output += G;
                            B.value += G;
                            t.dots = true;
                            continue;
                        }
                        if (m.braces + m.parens === 0 && B.type !== "bos" && B.type !== "slash") {
                            push({
                                type: "text",
                                value: G,
                                output: h
                            });
                            continue;
                        }
                        push({
                            type: "dot",
                            value: G,
                            output: h
                        });
                        continue;
                    }
                    if (G === "?") {
                        const t = B && B.value === "(";
                        if (!t && u.noextglob !== true && D() === "(" && D(2) !== "?") {
                            extglobOpen("qmark", G);
                            continue;
                        }
                        if (B && B.type === "paren") {
                            const t = D();
                            let e = G;
                            if (B.value === "(" && !/[!=<:]/.test(t) || t === "<" && !/<([!=]|\w+>)/.test(remaining())) {
                                e = `\\${G}`;
                            }
                            push({
                                type: "text",
                                value: G,
                                output: e
                            });
                            continue;
                        }
                        if (u.dot !== true && (B.type === "slash" || B.type === "bos")) {
                            push({
                                type: "qmark",
                                value: G,
                                output: v
                            });
                            continue;
                        }
                        push({
                            type: "qmark",
                            value: G,
                            output: H
                        });
                        continue;
                    }
                    if (G === "!") {
                        if (u.noextglob !== true && D() === "(") {
                            if (D(2) !== "?" || !/[!=<:]/.test(D(3))) {
                                extglobOpen("negate", G);
                                continue;
                            }
                        }
                        if (u.nonegate !== true && m.index === 0) {
                            negate();
                            continue;
                        }
                    }
                    if (G === "+") {
                        if (u.noextglob !== true && D() === "(" && D(2) !== "?") {
                            extglobOpen("plus", G);
                            continue;
                        }
                        if (B && B.value === "(" || u.regex === false) {
                            push({
                                type: "plus",
                                value: G,
                                output: g
                            });
                            continue;
                        }
                        if (B && (B.type === "bracket" || B.type === "paren" || B.type === "brace") || m.parens > 0) {
                            push({
                                type: "plus",
                                value: G
                            });
                            continue;
                        }
                        push({
                            type: "plus",
                            value: g
                        });
                        continue;
                    }
                    if (G === "@") {
                        if (u.noextglob !== true && D() === "(" && D(2) !== "?") {
                            push({
                                type: "at",
                                extglob: true,
                                value: G,
                                output: ""
                            });
                            continue;
                        }
                        push({
                            type: "text",
                            value: G
                        });
                        continue;
                    }
                    if (G !== "*") {
                        if (G === "$" || G === "^") {
                            G = `\\${G}`;
                        }
                        const t = a.exec(remaining());
                        if (t) {
                            G += t[0];
                            m.index += t[0].length;
                        }
                        push({
                            type: "text",
                            value: G
                        });
                        continue;
                    }
                    if (B && (B.type === "globstar" || B.star === true)) {
                        B.type = "star";
                        B.star = true;
                        B.value += G;
                        B.output = k;
                        m.backtrack = true;
                        m.globstar = true;
                        consume(G);
                        continue;
                    }
                    let e = remaining();
                    if (u.noextglob !== true && /^\([^?]/.test(e)) {
                        extglobOpen("star", G);
                        continue;
                    }
                    if (B.type === "star") {
                        if (u.noglobstar === true) {
                            consume(G);
                            continue;
                        }
                        const n = B.prev;
                        const o = n.prev;
                        const s = n.type === "slash" || n.type === "bos";
                        const r = o && (o.type === "star" || o.type === "globstar");
                        if (u.bash === true && (!s || e[0] && e[0] !== "/")) {
                            push({
                                type: "star",
                                value: G,
                                output: ""
                            });
                            continue;
                        }
                        const a = m.braces > 0 && (n.type === "comma" || n.type === "brace");
                        const i = w.length && (n.type === "pipe" || n.type === "paren");
                        if (!s && n.type !== "paren" && !a && !i) {
                            push({
                                type: "star",
                                value: G,
                                output: ""
                            });
                            continue;
                        }
                        while(e.slice(0, 3) === "/**"){
                            const u = t[m.index + 4];
                            if (u && u !== "/") {
                                break;
                            }
                            e = e.slice(3);
                            consume("/**", 3);
                        }
                        if (n.type === "bos" && eos()) {
                            B.type = "globstar";
                            B.value += G;
                            B.output = globstar(u);
                            m.output = B.output;
                            m.globstar = true;
                            consume(G);
                            continue;
                        }
                        if (n.type === "slash" && n.prev.type !== "bos" && !r && eos()) {
                            m.output = m.output.slice(0, -(n.output + B.output).length);
                            n.output = `(?:${n.output}`;
                            B.type = "globstar";
                            B.output = globstar(u) + (u.strictSlashes ? ")" : "|$)");
                            B.value += G;
                            m.globstar = true;
                            m.output += n.output + B.output;
                            consume(G);
                            continue;
                        }
                        if (n.type === "slash" && n.prev.type !== "bos" && e[0] === "/") {
                            const t = e[1] !== void 0 ? "|$" : "";
                            m.output = m.output.slice(0, -(n.output + B.output).length);
                            n.output = `(?:${n.output}`;
                            B.type = "globstar";
                            B.output = `${globstar(u)}${b}|${b}${t})`;
                            B.value += G;
                            m.output += n.output + B.output;
                            m.globstar = true;
                            consume(G + M());
                            push({
                                type: "slash",
                                value: "/",
                                output: ""
                            });
                            continue;
                        }
                        if (n.type === "bos" && e[0] === "/") {
                            B.type = "globstar";
                            B.value += G;
                            B.output = `(?:^|${b}|${globstar(u)}${b})`;
                            m.output = B.output;
                            m.globstar = true;
                            consume(G + M());
                            push({
                                type: "slash",
                                value: "/",
                                output: ""
                            });
                            continue;
                        }
                        m.output = m.output.slice(0, -B.output.length);
                        B.type = "globstar";
                        B.output = globstar(u);
                        B.value += G;
                        m.output += B.output;
                        m.globstar = true;
                        consume(G);
                        continue;
                    }
                    const n = {
                        type: "star",
                        value: G,
                        output: k
                    };
                    if (u.bash === true) {
                        n.output = ".*?";
                        if (B.type === "bos" || B.type === "slash") {
                            n.output = T + n.output;
                        }
                        push(n);
                        continue;
                    }
                    if (B && (B.type === "bracket" || B.type === "paren") && u.regex === true) {
                        n.output = G;
                        push(n);
                        continue;
                    }
                    if (m.index === m.start || B.type === "slash" || B.type === "dot") {
                        if (B.type === "dot") {
                            m.output += x;
                            B.output += x;
                        } else if (u.dot === true) {
                            m.output += S;
                            B.output += S;
                        } else {
                            m.output += T;
                            B.output += T;
                        }
                        if (D() !== "*") {
                            m.output += C;
                            B.output += C;
                        }
                    }
                    push(n);
                }
                while(m.brackets > 0){
                    if (u.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
                    m.output = o.escapeLast(m.output, "[");
                    decrement("brackets");
                }
                while(m.parens > 0){
                    if (u.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
                    m.output = o.escapeLast(m.output, "(");
                    decrement("parens");
                }
                while(m.braces > 0){
                    if (u.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
                    m.output = o.escapeLast(m.output, "{");
                    decrement("braces");
                }
                if (u.strictSlashes !== true && (B.type === "star" || B.type === "bracket")) {
                    push({
                        type: "maybe_slash",
                        value: "",
                        output: `${b}?`
                    });
                }
                if (m.backtrack === true) {
                    m.output = "";
                    for (const t of m.tokens){
                        m.output += t.output != null ? t.output : t.value;
                        if (t.suffix) {
                            m.output += t.suffix;
                        }
                    }
                }
                return m;
            };
            parse.fastpaths = (t, e)=>{
                const u = {
                    ...e
                };
                const r = typeof u.maxLength === "number" ? Math.min(s, u.maxLength) : s;
                const a = t.length;
                if (a > r) {
                    throw new SyntaxError(`Input length: ${a}, exceeds maximum allowed length: ${r}`);
                }
                t = c[t] || t;
                const { DOT_LITERAL: i, SLASH_LITERAL: p, ONE_CHAR: l, DOTS_SLASH: f, NO_DOT: A, NO_DOTS: _, NO_DOTS_SLASH: R, STAR: E, START_ANCHOR: h } = n.globChars(u.windows);
                const g = u.dot ? _ : A;
                const b = u.dot ? R : A;
                const C = u.capture ? "" : "?:";
                const y = {
                    negated: false,
                    prefix: ""
                };
                let $ = u.bash === true ? ".*?" : E;
                if (u.capture) {
                    $ = `(${$})`;
                }
                const globstar = (t)=>{
                    if (t.noglobstar === true) return $;
                    return `(${C}(?:(?!${h}${t.dot ? f : i}).)*?)`;
                };
                const create = (t)=>{
                    switch(t){
                        case "*":
                            return `${g}${l}${$}`;
                        case ".*":
                            return `${i}${l}${$}`;
                        case "*.*":
                            return `${g}${$}${i}${l}${$}`;
                        case "*/*":
                            return `${g}${$}${p}${l}${b}${$}`;
                        case "**":
                            return g + globstar(u);
                        case "**/*":
                            return `(?:${g}${globstar(u)}${p})?${b}${l}${$}`;
                        case "**/*.*":
                            return `(?:${g}${globstar(u)}${p})?${b}${$}${i}${l}${$}`;
                        case "**/.*":
                            return `(?:${g}${globstar(u)}${p})?${i}${l}${$}`;
                        default:
                            {
                                const e = /^(.*?)\.(\w+)$/.exec(t);
                                if (!e) return;
                                const u = create(e[1]);
                                if (!u) return;
                                return u + i + e[2];
                            }
                    }
                };
                const x = o.removePrefix(t, y);
                let S = create(x);
                if (S && u.strictSlashes !== true) {
                    S += `${p}?`;
                }
                return S;
            };
            t.exports = parse;
        },
        510: (t, e, u)=>{
            const n = u(716);
            const o = u(697);
            const s = u(96);
            const r = u(154);
            const isObject = (t)=>t && typeof t === "object" && !Array.isArray(t);
            const picomatch = (t, e, u = false)=>{
                if (Array.isArray(t)) {
                    const n = t.map((t)=>picomatch(t, e, u));
                    const arrayMatcher = (t)=>{
                        for (const e of n){
                            const u = e(t);
                            if (u) return u;
                        }
                        return false;
                    };
                    return arrayMatcher;
                }
                const n = isObject(t) && t.tokens && t.input;
                if (t === "" || typeof t !== "string" && !n) {
                    throw new TypeError("Expected pattern to be a non-empty string");
                }
                const o = e || {};
                const s = o.windows;
                const r = n ? picomatch.compileRe(t, e) : picomatch.makeRe(t, e, false, true);
                const a = r.state;
                delete r.state;
                let isIgnored = ()=>false;
                if (o.ignore) {
                    const t = {
                        ...e,
                        ignore: null,
                        onMatch: null,
                        onResult: null
                    };
                    isIgnored = picomatch(o.ignore, t, u);
                }
                const matcher = (u, n = false)=>{
                    const { isMatch: i, match: c, output: p } = picomatch.test(u, r, e, {
                        glob: t,
                        posix: s
                    });
                    const l = {
                        glob: t,
                        state: a,
                        regex: r,
                        posix: s,
                        input: u,
                        output: p,
                        match: c,
                        isMatch: i
                    };
                    if (typeof o.onResult === "function") {
                        o.onResult(l);
                    }
                    if (i === false) {
                        l.isMatch = false;
                        return n ? l : false;
                    }
                    if (isIgnored(u)) {
                        if (typeof o.onIgnore === "function") {
                            o.onIgnore(l);
                        }
                        l.isMatch = false;
                        return n ? l : false;
                    }
                    if (typeof o.onMatch === "function") {
                        o.onMatch(l);
                    }
                    return n ? l : true;
                };
                if (u) {
                    matcher.state = a;
                }
                return matcher;
            };
            picomatch.test = (t, e, u, { glob: n, posix: o } = {})=>{
                if (typeof t !== "string") {
                    throw new TypeError("Expected input to be a string");
                }
                if (t === "") {
                    return {
                        isMatch: false,
                        output: ""
                    };
                }
                const r = u || {};
                const a = r.format || (o ? s.toPosixSlashes : null);
                let i = t === n;
                let c = i && a ? a(t) : t;
                if (i === false) {
                    c = a ? a(t) : t;
                    i = c === n;
                }
                if (i === false || r.capture === true) {
                    if (r.matchBase === true || r.basename === true) {
                        i = picomatch.matchBase(t, e, u, o);
                    } else {
                        i = e.exec(c);
                    }
                }
                return {
                    isMatch: Boolean(i),
                    match: i,
                    output: c
                };
            };
            picomatch.matchBase = (t, e, u)=>{
                const n = e instanceof RegExp ? e : picomatch.makeRe(e, u);
                return n.test(s.basename(t));
            };
            picomatch.isMatch = (t, e, u)=>picomatch(e, u)(t);
            picomatch.parse = (t, e)=>{
                if (Array.isArray(t)) return t.map((t)=>picomatch.parse(t, e));
                return o(t, {
                    ...e,
                    fastpaths: false
                });
            };
            picomatch.scan = (t, e)=>n(t, e);
            picomatch.compileRe = (t, e, u = false, n = false)=>{
                if (u === true) {
                    return t.output;
                }
                const o = e || {};
                const s = o.contains ? "" : "^";
                const r = o.contains ? "" : "$";
                let a = `${s}(?:${t.output})${r}`;
                if (t && t.negated === true) {
                    a = `^(?!${a}).*$`;
                }
                const i = picomatch.toRegex(a, e);
                if (n === true) {
                    i.state = t;
                }
                return i;
            };
            picomatch.makeRe = (t, e = {}, u = false, n = false)=>{
                if (!t || typeof t !== "string") {
                    throw new TypeError("Expected a non-empty string");
                }
                let s = {
                    negated: false,
                    fastpaths: true
                };
                if (e.fastpaths !== false && (t[0] === "." || t[0] === "*")) {
                    s.output = o.fastpaths(t, e);
                }
                if (!s.output) {
                    s = o(t, e);
                }
                return picomatch.compileRe(s, e, u, n);
            };
            picomatch.toRegex = (t, e)=>{
                try {
                    const u = e || {};
                    return new RegExp(t, u.flags || (u.nocase ? "i" : ""));
                } catch (t) {
                    if (e && e.debug === true) throw t;
                    return /$^/;
                }
            };
            picomatch.constants = r;
            t.exports = picomatch;
        },
        716: (t, e, u)=>{
            const n = u(96);
            const { CHAR_ASTERISK: o, CHAR_AT: s, CHAR_BACKWARD_SLASH: r, CHAR_COMMA: a, CHAR_DOT: i, CHAR_EXCLAMATION_MARK: c, CHAR_FORWARD_SLASH: p, CHAR_LEFT_CURLY_BRACE: l, CHAR_LEFT_PARENTHESES: f, CHAR_LEFT_SQUARE_BRACKET: A, CHAR_PLUS: _, CHAR_QUESTION_MARK: R, CHAR_RIGHT_CURLY_BRACE: E, CHAR_RIGHT_PARENTHESES: h, CHAR_RIGHT_SQUARE_BRACKET: g } = u(154);
            const isPathSeparator = (t)=>t === p || t === r;
            const depth = (t)=>{
                if (t.isPrefix !== true) {
                    t.depth = t.isGlobstar ? Infinity : 1;
                }
            };
            const scan = (t, e)=>{
                const u = e || {};
                const b = t.length - 1;
                const C = u.parts === true || u.scanToEnd === true;
                const y = [];
                const $ = [];
                const x = [];
                let S = t;
                let H = -1;
                let v = 0;
                let d = 0;
                let L = false;
                let T = false;
                let O = false;
                let k = false;
                let m = false;
                let w = false;
                let N = false;
                let I = false;
                let B = false;
                let G = false;
                let D = 0;
                let M;
                let P;
                let K = {
                    value: "",
                    depth: 0,
                    isGlob: false
                };
                const eos = ()=>H >= b;
                const peek = ()=>S.charCodeAt(H + 1);
                const advance = ()=>{
                    M = P;
                    return S.charCodeAt(++H);
                };
                while(H < b){
                    P = advance();
                    let t;
                    if (P === r) {
                        N = K.backslashes = true;
                        P = advance();
                        if (P === l) {
                            w = true;
                        }
                        continue;
                    }
                    if (w === true || P === l) {
                        D++;
                        while(eos() !== true && (P = advance())){
                            if (P === r) {
                                N = K.backslashes = true;
                                advance();
                                continue;
                            }
                            if (P === l) {
                                D++;
                                continue;
                            }
                            if (w !== true && P === i && (P = advance()) === i) {
                                L = K.isBrace = true;
                                O = K.isGlob = true;
                                G = true;
                                if (C === true) {
                                    continue;
                                }
                                break;
                            }
                            if (w !== true && P === a) {
                                L = K.isBrace = true;
                                O = K.isGlob = true;
                                G = true;
                                if (C === true) {
                                    continue;
                                }
                                break;
                            }
                            if (P === E) {
                                D--;
                                if (D === 0) {
                                    w = false;
                                    L = K.isBrace = true;
                                    G = true;
                                    break;
                                }
                            }
                        }
                        if (C === true) {
                            continue;
                        }
                        break;
                    }
                    if (P === p) {
                        y.push(H);
                        $.push(K);
                        K = {
                            value: "",
                            depth: 0,
                            isGlob: false
                        };
                        if (G === true) continue;
                        if (M === i && H === v + 1) {
                            v += 2;
                            continue;
                        }
                        d = H + 1;
                        continue;
                    }
                    if (u.noext !== true) {
                        const t = P === _ || P === s || P === o || P === R || P === c;
                        if (t === true && peek() === f) {
                            O = K.isGlob = true;
                            k = K.isExtglob = true;
                            G = true;
                            if (P === c && H === v) {
                                B = true;
                            }
                            if (C === true) {
                                while(eos() !== true && (P = advance())){
                                    if (P === r) {
                                        N = K.backslashes = true;
                                        P = advance();
                                        continue;
                                    }
                                    if (P === h) {
                                        O = K.isGlob = true;
                                        G = true;
                                        break;
                                    }
                                }
                                continue;
                            }
                            break;
                        }
                    }
                    if (P === o) {
                        if (M === o) m = K.isGlobstar = true;
                        O = K.isGlob = true;
                        G = true;
                        if (C === true) {
                            continue;
                        }
                        break;
                    }
                    if (P === R) {
                        O = K.isGlob = true;
                        G = true;
                        if (C === true) {
                            continue;
                        }
                        break;
                    }
                    if (P === A) {
                        while(eos() !== true && (t = advance())){
                            if (t === r) {
                                N = K.backslashes = true;
                                advance();
                                continue;
                            }
                            if (t === g) {
                                T = K.isBracket = true;
                                O = K.isGlob = true;
                                G = true;
                                break;
                            }
                        }
                        if (C === true) {
                            continue;
                        }
                        break;
                    }
                    if (u.nonegate !== true && P === c && H === v) {
                        I = K.negated = true;
                        v++;
                        continue;
                    }
                    if (u.noparen !== true && P === f) {
                        O = K.isGlob = true;
                        if (C === true) {
                            while(eos() !== true && (P = advance())){
                                if (P === f) {
                                    N = K.backslashes = true;
                                    P = advance();
                                    continue;
                                }
                                if (P === h) {
                                    G = true;
                                    break;
                                }
                            }
                            continue;
                        }
                        break;
                    }
                    if (O === true) {
                        G = true;
                        if (C === true) {
                            continue;
                        }
                        break;
                    }
                }
                if (u.noext === true) {
                    k = false;
                    O = false;
                }
                let U = S;
                let X = "";
                let F = "";
                if (v > 0) {
                    X = S.slice(0, v);
                    S = S.slice(v);
                    d -= v;
                }
                if (U && O === true && d > 0) {
                    U = S.slice(0, d);
                    F = S.slice(d);
                } else if (O === true) {
                    U = "";
                    F = S;
                } else {
                    U = S;
                }
                if (U && U !== "" && U !== "/" && U !== S) {
                    if (isPathSeparator(U.charCodeAt(U.length - 1))) {
                        U = U.slice(0, -1);
                    }
                }
                if (u.unescape === true) {
                    if (F) F = n.removeBackslashes(F);
                    if (U && N === true) {
                        U = n.removeBackslashes(U);
                    }
                }
                const Q = {
                    prefix: X,
                    input: t,
                    start: v,
                    base: U,
                    glob: F,
                    isBrace: L,
                    isBracket: T,
                    isGlob: O,
                    isExtglob: k,
                    isGlobstar: m,
                    negated: I,
                    negatedExtglob: B
                };
                if (u.tokens === true) {
                    Q.maxDepth = 0;
                    if (!isPathSeparator(P)) {
                        $.push(K);
                    }
                    Q.tokens = $;
                }
                if (u.parts === true || u.tokens === true) {
                    let e;
                    for(let n = 0; n < y.length; n++){
                        const o = e ? e + 1 : v;
                        const s = y[n];
                        const r = t.slice(o, s);
                        if (u.tokens) {
                            if (n === 0 && v !== 0) {
                                $[n].isPrefix = true;
                                $[n].value = X;
                            } else {
                                $[n].value = r;
                            }
                            depth($[n]);
                            Q.maxDepth += $[n].depth;
                        }
                        if (n !== 0 || r !== "") {
                            x.push(r);
                        }
                        e = s;
                    }
                    if (e && e + 1 < t.length) {
                        const n = t.slice(e + 1);
                        x.push(n);
                        if (u.tokens) {
                            $[$.length - 1].value = n;
                            depth($[$.length - 1]);
                            Q.maxDepth += $[$.length - 1].depth;
                        }
                    }
                    Q.slashes = y;
                    Q.parts = x;
                }
                return Q;
            };
            t.exports = scan;
        },
        96: (t, e, u)=>{
            const { REGEX_BACKSLASH: n, REGEX_REMOVE_BACKSLASH: o, REGEX_SPECIAL_CHARS: s, REGEX_SPECIAL_CHARS_GLOBAL: r } = u(154);
            e.isObject = (t)=>t !== null && typeof t === "object" && !Array.isArray(t);
            e.hasRegexChars = (t)=>s.test(t);
            e.isRegexChar = (t)=>t.length === 1 && e.hasRegexChars(t);
            e.escapeRegex = (t)=>t.replace(r, "\\$1");
            e.toPosixSlashes = (t)=>t.replace(n, "/");
            e.removeBackslashes = (t)=>t.replace(o, (t)=>t === "\\" ? "" : t);
            e.escapeLast = (t, u, n)=>{
                const o = t.lastIndexOf(u, n);
                if (o === -1) return t;
                if (t[o - 1] === "\\") return e.escapeLast(t, u, o - 1);
                return `${t.slice(0, o)}\\${t.slice(o)}`;
            };
            e.removePrefix = (t, e = {})=>{
                let u = t;
                if (u.startsWith("./")) {
                    u = u.slice(2);
                    e.prefix = "./";
                }
                return u;
            };
            e.wrapOutput = (t, e = {}, u = {})=>{
                const n = u.contains ? "" : "^";
                const o = u.contains ? "" : "$";
                let s = `${n}(?:${t})${o}`;
                if (e.negated === true) {
                    s = `(?:^(?!${s}).*$)`;
                }
                return s;
            };
            e.basename = (t, { windows: e } = {})=>{
                const u = t.split(e ? /[\\/]/ : "/");
                const n = u[u.length - 1];
                if (n === "") {
                    return u[u.length - 2];
                }
                return n;
            };
        }
    };
    var e = {};
    function __nccwpck_require__(u) {
        var n = e[u];
        if (n !== undefined) {
            return n.exports;
        }
        var o = e[u] = {
            exports: {}
        };
        var s = true;
        try {
            t[u](o, o.exports, __nccwpck_require__);
            s = false;
        } finally{
            if (s) delete e[u];
        }
        return o.exports;
    }
    if (typeof __nccwpck_require__ !== "undefined") __nccwpck_require__.ab = ("TURBOPACK compile-time value", "/ROOT/production/dad-strength-app/node_modules/next/dist/compiled/picomatch") + "/";
    var u = __nccwpck_require__(170);
    module.exports = u;
})();
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/match-local-pattern.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    hasLocalMatch: null,
    matchLocalPattern: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    hasLocalMatch: function() {
        return hasLocalMatch;
    },
    matchLocalPattern: function() {
        return matchLocalPattern;
    }
});
const _picomatch = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/picomatch/index.js [app-client] (ecmascript)");
function matchLocalPattern(pattern, url) {
    if (pattern.search !== undefined) {
        if (pattern.search !== url.search) {
            return false;
        }
    }
    if (!(0, _picomatch.makeRe)(pattern.pathname ?? '**', {
        dot: true
    }).test(url.pathname)) {
        return false;
    }
    return true;
}
function hasLocalMatch(localPatterns, urlPathAndQuery) {
    if (!localPatterns) {
        // if the user didn't define "localPatterns", we allow all local images
        return true;
    }
    const url = new URL(urlPathAndQuery, 'http://n');
    return localPatterns.some((p)=>matchLocalPattern(p, url));
} //# sourceMappingURL=match-local-pattern.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/match-remote-pattern.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    hasRemoteMatch: null,
    matchRemotePattern: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    hasRemoteMatch: function() {
        return hasRemoteMatch;
    },
    matchRemotePattern: function() {
        return matchRemotePattern;
    }
});
const _picomatch = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/picomatch/index.js [app-client] (ecmascript)");
function matchRemotePattern(pattern, url) {
    if (pattern.protocol !== undefined) {
        if (pattern.protocol.replace(/:$/, '') !== url.protocol.replace(/:$/, '')) {
            return false;
        }
    }
    if (pattern.port !== undefined) {
        if (pattern.port !== url.port) {
            return false;
        }
    }
    if (pattern.hostname === undefined) {
        throw Object.defineProperty(new Error(`Pattern should define hostname but found\n${JSON.stringify(pattern)}`), "__NEXT_ERROR_CODE", {
            value: "E410",
            enumerable: false,
            configurable: true
        });
    } else {
        if (!(0, _picomatch.makeRe)(pattern.hostname).test(url.hostname)) {
            return false;
        }
    }
    if (pattern.search !== undefined) {
        if (pattern.search !== url.search) {
            return false;
        }
    }
    // Should be the same as writeImagesManifest()
    if (!(0, _picomatch.makeRe)(pattern.pathname ?? '**', {
        dot: true
    }).test(url.pathname)) {
        return false;
    }
    return true;
}
function hasRemoteMatch(domains, remotePatterns, url) {
    return domains.some((domain)=>url.hostname === domain) || remotePatterns.some((p)=>matchRemotePattern(p, url));
} //# sourceMappingURL=match-remote-pattern.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-loader.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "default", {
    enumerable: true,
    get: function() {
        return _default;
    }
});
const _findclosestquality = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/find-closest-quality.js [app-client] (ecmascript)");
const _deploymentid = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/deployment-id.js [app-client] (ecmascript)");
function defaultLoader({ config, src, width, quality }) {
    if (src.startsWith('/') && src.includes('?') && config.localPatterns?.length === 1 && config.localPatterns[0].pathname === '**' && config.localPatterns[0].search === '') {
        throw Object.defineProperty(new Error(`Image with src "${src}" is using a query string which is not configured in images.localPatterns.` + `\nRead more: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`), "__NEXT_ERROR_CODE", {
            value: "E871",
            enumerable: false,
            configurable: true
        });
    }
    if ("TURBOPACK compile-time truthy", 1) {
        const missingValues = [];
        // these should always be provided but make sure they are
        if (!src) missingValues.push('src');
        if (!width) missingValues.push('width');
        if (missingValues.length > 0) {
            throw Object.defineProperty(new Error(`Next Image Optimization requires ${missingValues.join(', ')} to be provided. Make sure you pass them as props to the \`next/image\` component. Received: ${JSON.stringify({
                src,
                width,
                quality
            })}`), "__NEXT_ERROR_CODE", {
                value: "E188",
                enumerable: false,
                configurable: true
            });
        }
        if (src.startsWith('//')) {
            throw Object.defineProperty(new Error(`Failed to parse src "${src}" on \`next/image\`, protocol-relative URL (//) must be changed to an absolute URL (http:// or https://)`), "__NEXT_ERROR_CODE", {
                value: "E360",
                enumerable: false,
                configurable: true
            });
        }
        if (src.startsWith('/') && config.localPatterns) {
            if ("TURBOPACK compile-time truthy", 1) {
                // We use dynamic require because this should only error in development
                const { hasLocalMatch } = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/match-local-pattern.js [app-client] (ecmascript)");
                if (!hasLocalMatch(config.localPatterns, src)) {
                    throw Object.defineProperty(new Error(`Invalid src prop (${src}) on \`next/image\` does not match \`images.localPatterns\` configured in your \`next.config.js\`\n` + `See more info: https://nextjs.org/docs/messages/next-image-unconfigured-localpatterns`), "__NEXT_ERROR_CODE", {
                        value: "E426",
                        enumerable: false,
                        configurable: true
                    });
                }
            }
        }
        if (!src.startsWith('/') && (config.domains || config.remotePatterns)) {
            let parsedSrc;
            try {
                parsedSrc = new URL(src);
            } catch (err) {
                console.error(err);
                throw Object.defineProperty(new Error(`Failed to parse src "${src}" on \`next/image\`, if using relative image it must start with a leading slash "/" or be an absolute URL (http:// or https://)`), "__NEXT_ERROR_CODE", {
                    value: "E63",
                    enumerable: false,
                    configurable: true
                });
            }
            if ("TURBOPACK compile-time truthy", 1) {
                // We use dynamic require because this should only error in development
                const { hasRemoteMatch } = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/match-remote-pattern.js [app-client] (ecmascript)");
                if (!hasRemoteMatch(config.domains, config.remotePatterns, parsedSrc)) {
                    throw Object.defineProperty(new Error(`Invalid src prop (${src}) on \`next/image\`, hostname "${parsedSrc.hostname}" is not configured under images in your \`next.config.js\`\n` + `See more info: https://nextjs.org/docs/messages/next-image-unconfigured-host`), "__NEXT_ERROR_CODE", {
                        value: "E231",
                        enumerable: false,
                        configurable: true
                    });
                }
            }
        }
    }
    const q = (0, _findclosestquality.findClosestQuality)(quality, config);
    let deploymentId = (0, _deploymentid.getDeploymentId)();
    return `${config.path}?url=${encodeURIComponent(src)}&w=${width}&q=${q}${src.startsWith('/') && deploymentId ? `&dpl=${deploymentId}` : ''}`;
}
// We use this to determine if the import is the default loader
// or a custom loader defined by the user in next.config.js
defaultLoader.__next_img_default = true;
const _default = defaultLoader; //# sourceMappingURL=image-loader.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/client/use-merged-ref.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "useMergedRef", {
    enumerable: true,
    get: function() {
        return useMergedRef;
    }
});
const _react = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
function useMergedRef(refA, refB) {
    const cleanupA = (0, _react.useRef)(null);
    const cleanupB = (0, _react.useRef)(null);
    // NOTE: In theory, we could skip the wrapping if only one of the refs is non-null.
    // (this happens often if the user doesn't pass a ref to Link/Form/Image)
    // But this can cause us to leak a cleanup-ref into user code (previously via `<Link legacyBehavior>`),
    // and the user might pass that ref into ref-merging library that doesn't support cleanup refs
    // (because it hasn't been updated for React 19)
    // which can then cause things to blow up, because a cleanup-returning ref gets called with `null`.
    // So in practice, it's safer to be defensive and always wrap the ref, even on React 19.
    return (0, _react.useCallback)((current)=>{
        if (current === null) {
            const cleanupFnA = cleanupA.current;
            if (cleanupFnA) {
                cleanupA.current = null;
                cleanupFnA();
            }
            const cleanupFnB = cleanupB.current;
            if (cleanupFnB) {
                cleanupB.current = null;
                cleanupFnB();
            }
        } else {
            if (refA) {
                cleanupA.current = applyRef(refA, current);
            }
            if (refB) {
                cleanupB.current = applyRef(refB, current);
            }
        }
    }, [
        refA,
        refB
    ]);
}
function applyRef(refA, current) {
    if (typeof refA === 'function') {
        const cleanup = refA(current);
        if (typeof cleanup === 'function') {
            return cleanup;
        } else {
            return ()=>refA(null);
        }
    } else {
        refA.current = current;
        return ()=>{
            refA.current = null;
        };
    }
}
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=use-merged-ref.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/client/image-component.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
'use client';
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "Image", {
    enumerable: true,
    get: function() {
        return Image;
    }
});
const _interop_require_default = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _interop_require_wildcard = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/@swc/helpers/cjs/_interop_require_wildcard.cjs [app-client] (ecmascript)");
const _jsxruntime = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/jsx-runtime.js [app-client] (ecmascript)");
const _react = /*#__PURE__*/ _interop_require_wildcard._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)"));
const _reactdom = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)"));
const _head = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/head.js [app-client] (ecmascript)"));
const _getimgprops = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/get-img-props.js [app-client] (ecmascript)");
const _imageconfig = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-config.js [app-client] (ecmascript)");
const _imageconfigcontextsharedruntime = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-config-context.shared-runtime.js [app-client] (ecmascript)");
const _warnonce = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/utils/warn-once.js [app-client] (ecmascript)");
const _routercontextsharedruntime = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/router-context.shared-runtime.js [app-client] (ecmascript)");
const _imageloader = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-loader.js [app-client] (ecmascript)"));
const _usemergedref = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/client/use-merged-ref.js [app-client] (ecmascript)");
// This is replaced by webpack define plugin
const configEnv = ("TURBOPACK compile-time value", {
    "deviceSizes": ("TURBOPACK compile-time value", [
        ("TURBOPACK compile-time value", 640),
        ("TURBOPACK compile-time value", 750),
        ("TURBOPACK compile-time value", 828),
        ("TURBOPACK compile-time value", 1080),
        ("TURBOPACK compile-time value", 1200),
        ("TURBOPACK compile-time value", 1920),
        ("TURBOPACK compile-time value", 2048),
        ("TURBOPACK compile-time value", 3840)
    ]),
    "imageSizes": ("TURBOPACK compile-time value", [
        ("TURBOPACK compile-time value", 32),
        ("TURBOPACK compile-time value", 48),
        ("TURBOPACK compile-time value", 64),
        ("TURBOPACK compile-time value", 96),
        ("TURBOPACK compile-time value", 128),
        ("TURBOPACK compile-time value", 256),
        ("TURBOPACK compile-time value", 384)
    ]),
    "qualities": ("TURBOPACK compile-time value", [
        ("TURBOPACK compile-time value", 75)
    ]),
    "path": ("TURBOPACK compile-time value", "/_next/image"),
    "loader": ("TURBOPACK compile-time value", "default"),
    "dangerouslyAllowSVG": ("TURBOPACK compile-time value", false),
    "unoptimized": ("TURBOPACK compile-time value", false),
    "domains": ("TURBOPACK compile-time value", []),
    "remotePatterns": ("TURBOPACK compile-time value", []),
    "localPatterns": ("TURBOPACK compile-time value", [
        ("TURBOPACK compile-time value", {
            "pathname": ("TURBOPACK compile-time value", "**"),
            "search": ("TURBOPACK compile-time value", "")
        })
    ])
});
if (typeof window === 'undefined') {
    ;
    globalThis.__NEXT_IMAGE_IMPORTED = true;
}
// See https://stackoverflow.com/q/39777833/266535 for why we use this ref
// handler instead of the img's onLoad attribute.
function handleLoading(img, placeholder, onLoadRef, onLoadingCompleteRef, setBlurComplete, unoptimized, sizesInput) {
    const src = img?.src;
    if (!img || img['data-loaded-src'] === src) {
        return;
    }
    img['data-loaded-src'] = src;
    const p = 'decode' in img ? img.decode() : Promise.resolve();
    p.catch(()=>{}).then(()=>{
        if (!img.parentElement || !img.isConnected) {
            // Exit early in case of race condition:
            // - onload() is called
            // - decode() is called but incomplete
            // - unmount is called
            // - decode() completes
            return;
        }
        if (placeholder !== 'empty') {
            setBlurComplete(true);
        }
        if (onLoadRef?.current) {
            // Since we don't have the SyntheticEvent here,
            // we must create one with the same shape.
            // See https://reactjs.org/docs/events.html
            const event = new Event('load');
            Object.defineProperty(event, 'target', {
                writable: false,
                value: img
            });
            let prevented = false;
            let stopped = false;
            onLoadRef.current({
                ...event,
                nativeEvent: event,
                currentTarget: img,
                target: img,
                isDefaultPrevented: ()=>prevented,
                isPropagationStopped: ()=>stopped,
                persist: ()=>{},
                preventDefault: ()=>{
                    prevented = true;
                    event.preventDefault();
                },
                stopPropagation: ()=>{
                    stopped = true;
                    event.stopPropagation();
                }
            });
        }
        if (onLoadingCompleteRef?.current) {
            onLoadingCompleteRef.current(img);
        }
        if ("TURBOPACK compile-time truthy", 1) {
            const origSrc = new URL(src, 'http://n').searchParams.get('url') || src;
            if (img.getAttribute('data-nimg') === 'fill') {
                if (!unoptimized && (!sizesInput || sizesInput === '100vw')) {
                    let widthViewportRatio = img.getBoundingClientRect().width / window.innerWidth;
                    if (widthViewportRatio < 0.6) {
                        if (sizesInput === '100vw') {
                            (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has "fill" prop and "sizes" prop of "100vw", but image is not rendered at full viewport width. Please adjust "sizes" to improve page performance. Read more: https://nextjs.org/docs/api-reference/next/image#sizes`);
                        } else {
                            (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has "fill" but is missing "sizes" prop. Please add it to improve page performance. Read more: https://nextjs.org/docs/api-reference/next/image#sizes`);
                        }
                    }
                }
                if (img.parentElement) {
                    const { position } = window.getComputedStyle(img.parentElement);
                    const valid = [
                        'absolute',
                        'fixed',
                        'relative'
                    ];
                    if (!valid.includes(position)) {
                        (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has "fill" and parent element with invalid "position". Provided "${position}" should be one of ${valid.map(String).join(',')}.`);
                    }
                }
                if (img.height === 0) {
                    (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has "fill" and a height value of 0. This is likely because the parent element of the image has not been styled to have a set height.`);
                }
            }
            const heightModified = img.height.toString() !== img.getAttribute('height');
            const widthModified = img.width.toString() !== img.getAttribute('width');
            if (heightModified && !widthModified || !heightModified && widthModified) {
                (0, _warnonce.warnOnce)(`Image with src "${origSrc}" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio.`);
            }
        }
    });
}
function getDynamicProps(fetchPriority) {
    if (Boolean(_react.use)) {
        // In React 19.0.0 or newer, we must use camelCase
        // prop to avoid "Warning: Invalid DOM property".
        // See https://github.com/facebook/react/pull/25927
        return {
            fetchPriority
        };
    }
    // In React 18.2.0 or older, we must use lowercase prop
    // to avoid "Warning: Invalid DOM property".
    return {
        fetchpriority: fetchPriority
    };
}
const ImageElement = /*#__PURE__*/ (0, _react.forwardRef)(({ src, srcSet, sizes, height, width, decoding, className, style, fetchPriority, placeholder, loading, unoptimized, fill, onLoadRef, onLoadingCompleteRef, setBlurComplete, setShowAltText, sizesInput, onLoad, onError, ...rest }, forwardedRef)=>{
    const ownRef = (0, _react.useCallback)((img)=>{
        if (!img) {
            return;
        }
        if (onError) {
            // If the image has an error before react hydrates, then the error is lost.
            // The workaround is to wait until the image is mounted which is after hydration,
            // then we set the src again to trigger the error handler (if there was an error).
            // eslint-disable-next-line no-self-assign
            img.src = img.src;
        }
        if ("TURBOPACK compile-time truthy", 1) {
            if (!src) {
                console.error(`Image is missing required "src" property:`, img);
            }
            if (img.getAttribute('alt') === null) {
                console.error(`Image is missing required "alt" property. Please add Alternative Text to describe the image for screen readers and search engines.`);
            }
        }
        if (img.complete) {
            handleLoading(img, placeholder, onLoadRef, onLoadingCompleteRef, setBlurComplete, unoptimized, sizesInput);
        }
    }, [
        src,
        placeholder,
        onLoadRef,
        onLoadingCompleteRef,
        setBlurComplete,
        onError,
        unoptimized,
        sizesInput
    ]);
    const ref = (0, _usemergedref.useMergedRef)(forwardedRef, ownRef);
    return /*#__PURE__*/ (0, _jsxruntime.jsx)("img", {
        ...rest,
        ...getDynamicProps(fetchPriority),
        // It's intended to keep `loading` before `src` because React updates
        // props in order which causes Safari/Firefox to not lazy load properly.
        // See https://github.com/facebook/react/issues/25883
        loading: loading,
        width: width,
        height: height,
        decoding: decoding,
        "data-nimg": fill ? 'fill' : '1',
        className: className,
        style: style,
        // It's intended to keep `src` the last attribute because React updates
        // attributes in order. If we keep `src` the first one, Safari will
        // immediately start to fetch `src`, before `sizes` and `srcSet` are even
        // updated by React. That causes multiple unnecessary requests if `srcSet`
        // and `sizes` are defined.
        // This bug cannot be reproduced in Chrome or Firefox.
        sizes: sizes,
        srcSet: srcSet,
        src: src,
        ref: ref,
        onLoad: (event)=>{
            const img = event.currentTarget;
            handleLoading(img, placeholder, onLoadRef, onLoadingCompleteRef, setBlurComplete, unoptimized, sizesInput);
        },
        onError: (event)=>{
            // if the real image fails to load, this will ensure "alt" is visible
            setShowAltText(true);
            if (placeholder !== 'empty') {
                // If the real image fails to load, this will still remove the placeholder.
                setBlurComplete(true);
            }
            if (onError) {
                onError(event);
            }
        }
    });
});
function ImagePreload({ isAppRouter, imgAttributes }) {
    const opts = {
        as: 'image',
        imageSrcSet: imgAttributes.srcSet,
        imageSizes: imgAttributes.sizes,
        crossOrigin: imgAttributes.crossOrigin,
        referrerPolicy: imgAttributes.referrerPolicy,
        ...getDynamicProps(imgAttributes.fetchPriority)
    };
    if (isAppRouter && _reactdom.default.preload) {
        _reactdom.default.preload(imgAttributes.src, opts);
        return null;
    }
    return /*#__PURE__*/ (0, _jsxruntime.jsx)(_head.default, {
        children: /*#__PURE__*/ (0, _jsxruntime.jsx)("link", {
            rel: "preload",
            // Note how we omit the `href` attribute, as it would only be relevant
            // for browsers that do not support `imagesrcset`, and in those cases
            // it would cause the incorrect image to be preloaded.
            //
            // https://html.spec.whatwg.org/multipage/semantics.html#attr-link-imagesrcset
            href: imgAttributes.srcSet ? undefined : imgAttributes.src,
            ...opts
        }, '__nimg-' + imgAttributes.src + imgAttributes.srcSet + imgAttributes.sizes)
    });
}
const Image = /*#__PURE__*/ (0, _react.forwardRef)((props, forwardedRef)=>{
    const pagesRouter = (0, _react.useContext)(_routercontextsharedruntime.RouterContext);
    // We're in the app directory if there is no pages router.
    const isAppRouter = !pagesRouter;
    const configContext = (0, _react.useContext)(_imageconfigcontextsharedruntime.ImageConfigContext);
    const config = (0, _react.useMemo)(()=>{
        const c = configEnv || configContext || _imageconfig.imageConfigDefault;
        const allSizes = [
            ...c.deviceSizes,
            ...c.imageSizes
        ].sort((a, b)=>a - b);
        const deviceSizes = c.deviceSizes.sort((a, b)=>a - b);
        const qualities = c.qualities?.sort((a, b)=>a - b);
        return {
            ...c,
            allSizes,
            deviceSizes,
            qualities,
            // During the SSR, configEnv (__NEXT_IMAGE_OPTS) does not include
            // security sensitive configs like `localPatterns`, which is needed
            // during the server render to ensure it's validated. Therefore use
            // configContext, which holds the config from the server for validation.
            localPatterns: typeof window === 'undefined' ? configContext?.localPatterns : c.localPatterns
        };
    }, [
        configContext
    ]);
    const { onLoad, onLoadingComplete } = props;
    const onLoadRef = (0, _react.useRef)(onLoad);
    (0, _react.useEffect)(()=>{
        onLoadRef.current = onLoad;
    }, [
        onLoad
    ]);
    const onLoadingCompleteRef = (0, _react.useRef)(onLoadingComplete);
    (0, _react.useEffect)(()=>{
        onLoadingCompleteRef.current = onLoadingComplete;
    }, [
        onLoadingComplete
    ]);
    const [blurComplete, setBlurComplete] = (0, _react.useState)(false);
    const [showAltText, setShowAltText] = (0, _react.useState)(false);
    const { props: imgAttributes, meta: imgMeta } = (0, _getimgprops.getImgProps)(props, {
        defaultLoader: _imageloader.default,
        imgConf: config,
        blurComplete,
        showAltText
    });
    return /*#__PURE__*/ (0, _jsxruntime.jsxs)(_jsxruntime.Fragment, {
        children: [
            /*#__PURE__*/ (0, _jsxruntime.jsx)(ImageElement, {
                ...imgAttributes,
                unoptimized: imgMeta.unoptimized,
                placeholder: imgMeta.placeholder,
                fill: imgMeta.fill,
                onLoadRef: onLoadRef,
                onLoadingCompleteRef: onLoadingCompleteRef,
                setBlurComplete: setBlurComplete,
                setShowAltText: setShowAltText,
                sizesInput: props.sizes,
                ref: forwardedRef
            }),
            imgMeta.preload ? /*#__PURE__*/ (0, _jsxruntime.jsx)(ImagePreload, {
                isAppRouter: isAppRouter,
                imgAttributes: imgAttributes
            }) : null
        ]
    });
});
if ((typeof exports.default === 'function' || typeof exports.default === 'object' && exports.default !== null) && typeof exports.default.__esModule === 'undefined') {
    Object.defineProperty(exports.default, '__esModule', {
        value: true
    });
    Object.assign(exports.default, exports);
    module.exports = exports.default;
} //# sourceMappingURL=image-component.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-external.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
0 && (module.exports = {
    default: null,
    getImageProps: null
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
    });
}
_export(exports, {
    default: function() {
        return _default;
    },
    getImageProps: function() {
        return getImageProps;
    }
});
const _interop_require_default = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/@swc/helpers/cjs/_interop_require_default.cjs [app-client] (ecmascript)");
const _getimgprops = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/get-img-props.js [app-client] (ecmascript)");
const _imagecomponent = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/client/image-component.js [app-client] (ecmascript)");
const _imageloader = /*#__PURE__*/ _interop_require_default._(__turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-loader.js [app-client] (ecmascript)"));
function getImageProps(imgProps) {
    const { props } = (0, _getimgprops.getImgProps)(imgProps, {
        defaultLoader: _imageloader.default,
        // This is replaced by webpack define plugin
        imgConf: ("TURBOPACK compile-time value", {
            "deviceSizes": ("TURBOPACK compile-time value", [
                ("TURBOPACK compile-time value", 640),
                ("TURBOPACK compile-time value", 750),
                ("TURBOPACK compile-time value", 828),
                ("TURBOPACK compile-time value", 1080),
                ("TURBOPACK compile-time value", 1200),
                ("TURBOPACK compile-time value", 1920),
                ("TURBOPACK compile-time value", 2048),
                ("TURBOPACK compile-time value", 3840)
            ]),
            "imageSizes": ("TURBOPACK compile-time value", [
                ("TURBOPACK compile-time value", 32),
                ("TURBOPACK compile-time value", 48),
                ("TURBOPACK compile-time value", 64),
                ("TURBOPACK compile-time value", 96),
                ("TURBOPACK compile-time value", 128),
                ("TURBOPACK compile-time value", 256),
                ("TURBOPACK compile-time value", 384)
            ]),
            "qualities": ("TURBOPACK compile-time value", [
                ("TURBOPACK compile-time value", 75)
            ]),
            "path": ("TURBOPACK compile-time value", "/_next/image"),
            "loader": ("TURBOPACK compile-time value", "default"),
            "dangerouslyAllowSVG": ("TURBOPACK compile-time value", false),
            "unoptimized": ("TURBOPACK compile-time value", false),
            "domains": ("TURBOPACK compile-time value", []),
            "remotePatterns": ("TURBOPACK compile-time value", []),
            "localPatterns": ("TURBOPACK compile-time value", [
                ("TURBOPACK compile-time value", {
                    "pathname": ("TURBOPACK compile-time value", "**"),
                    "search": ("TURBOPACK compile-time value", "")
                })
            ])
        })
    });
    // Normally we don't care about undefined props because we pass to JSX,
    // but this exported function could be used by the end user for anything
    // so we delete undefined props to clean it up a little.
    for (const [key, value] of Object.entries(props)){
        if (value === undefined) {
            delete props[key];
        }
    }
    return {
        props
    };
}
const _default = _imagecomponent.Image; //# sourceMappingURL=image-external.js.map
}),
"[project]/production/dad-strength-app/node_modules/next/image.js [app-client] (ecmascript)", ((__turbopack_context__, module, exports) => {

module.exports = __turbopack_context__.r("[project]/production/dad-strength-app/node_modules/next/dist/shared/lib/image-external.js [app-client] (ecmascript)");
}),
]);

//# sourceMappingURL=a9784_7f9dc65c._.js.map