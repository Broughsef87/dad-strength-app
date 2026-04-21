(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/production/dad-strength-app/src/app/page.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>Home
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$utils$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/src/utils/supabase/client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$react$2f$dist$2f$index$2e$es$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/@supabase/auth-ui-react/dist/index.es.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/@supabase/auth-ui-shared/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$contexts$2f$ThemeContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/src/contexts/ThemeContext.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/image.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
;
;
;
function Home() {
    _s();
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$utils$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createClient"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { resolvedTheme } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$contexts$2f$ThemeContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"])();
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const authColors = resolvedTheme === 'light' ? {
        brand: '#C8820A',
        brandAccent: '#a86808',
        inputBackground: 'hsl(214 18% 93%)',
        inputBorder: 'hsl(214 22% 80%)',
        inputText: 'hsl(222 32% 11%)',
        inputPlaceholder: 'hsl(215 18% 58%)',
        inputLabelText: 'hsl(215 18% 40%)',
        messageText: 'hsl(215 18% 40%)',
        anchorTextColor: 'hsl(38 90% 36%)',
        dividerBackground: 'hsl(214 22% 80%)'
    } : {
        brand: '#C8820A',
        brandAccent: '#a86808',
        inputBackground: 'hsl(222 21% 7%)',
        inputBorder: 'hsl(214 35% 18%)',
        inputText: 'hsl(210 24% 80%)',
        inputPlaceholder: 'hsl(213 22% 32%)',
        inputLabelText: 'hsl(213 22% 52%)',
        messageText: 'hsl(213 22% 52%)',
        anchorTextColor: 'hsl(38 90% 41%)',
        dividerBackground: 'hsl(214 35% 18%)'
    };
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Home.useEffect": ()=>{
            const checkUser = {
                "Home.useEffect.checkUser": async ()=>{
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) router.push('/dashboard');
                    setLoading(false);
                }
            }["Home.useEffect.checkUser"];
            checkUser();
        }
    }["Home.useEffect"], [
        router,
        supabase.auth
    ]);
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex h-screen items-center justify-center bg-background",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col items-center gap-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "w-5 h-5 border border-brand border-t-transparent rounded-full animate-spin"
                    }, void 0, false, {
                        fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                        lineNumber: 56,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-muted-foreground text-[9px] uppercase tracking-[0.2em] font-display",
                        children: "Loading"
                    }, void 0, false, {
                        fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                        lineNumber: 57,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                lineNumber: 55,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
            lineNumber: 54,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-8",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative z-10 w-full max-w-sm space-y-10",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col items-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            src: "/logo-suite/ds_stacked_dark.png",
                            alt: "Dad Strength",
                            width: 224,
                            height: 112,
                            className: "dark:block hidden drop-shadow-2xl",
                            draggable: false,
                            priority: true
                        }, void 0, false, {
                            fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                            lineNumber: 70,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                            src: "/logo-suite/ds_stacked_light.png",
                            alt: "Dad Strength",
                            width: 224,
                            height: 112,
                            className: "dark:hidden block drop-shadow-2xl",
                            draggable: false,
                            priority: true
                        }, void 0, false, {
                            fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                            lineNumber: 79,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                    lineNumber: 68,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "ds-card p-6 shadow-2xl",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$react$2f$dist$2f$index$2e$es$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Auth"], {
                        supabaseClient: supabase,
                        appearance: {
                            theme: __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$auth$2d$ui$2d$shared$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ThemeSupa"],
                            variables: {
                                default: {
                                    colors: authColors
                                }
                            }
                        },
                        providers: [
                            'google'
                        ],
                        redirectTo: ("TURBOPACK compile-time truthy", 1) ? `${window.location.origin}/dashboard` : "TURBOPACK unreachable"
                    }, void 0, false, {
                        fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                        lineNumber: 92,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                    lineNumber: 91,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-center text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-[0.22em] font-display",
                    children: "Dad Strength · Built for the Iron Path"
                }, void 0, false, {
                    fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
                    lineNumber: 103,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
            lineNumber: 66,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/production/dad-strength-app/src/app/page.tsx",
        lineNumber: 64,
        columnNumber: 5
    }, this);
}
_s(Home, "oq1wEh3Z9HudUYFwmpL6yBkmypg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$contexts$2f$ThemeContext$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useTheme"]
    ];
});
_c = Home;
var _c;
__turbopack_context__.k.register(_c, "Home");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=production_dad-strength-app_src_app_page_tsx_8ecdd5bb._.js.map