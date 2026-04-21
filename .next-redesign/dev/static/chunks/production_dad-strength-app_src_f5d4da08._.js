(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/production/dad-strength-app/src/components/PageTransition.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>PageTransition
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/navigation.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function PageTransition({ children }) {
    _s();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnimatePresence"], {
        mode: "popLayout",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
            initial: {
                opacity: 0,
                x: 8
            },
            animate: {
                opacity: 1,
                x: 0
            },
            exit: {
                opacity: 0,
                x: -8
            },
            transition: {
                duration: 0.22,
                ease: [
                    0.25,
                    0.46,
                    0.45,
                    0.94
                ]
            },
            children: children
        }, pathname, false, {
            fileName: "[project]/production/dad-strength-app/src/components/PageTransition.tsx",
            lineNumber: 9,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/production/dad-strength-app/src/components/PageTransition.tsx",
        lineNumber: 8,
        columnNumber: 5
    }, this);
}
_s(PageTransition, "xbyQPtUVMO7MNj7WjJlpdWqRcTo=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"]
    ];
});
_c = PageTransition;
var _c;
__turbopack_context__.k.register(_c, "PageTransition");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/production/dad-strength-app/src/utils/supabase/client.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/@supabase/ssr/dist/module/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/@supabase/ssr/dist/module/createBrowserClient.js [app-client] (ecmascript)");
;
function createClient() {
    const url = ("TURBOPACK compile-time value", "https://fbybytovtvnbzqzdkbzf.supabase.co");
    const key = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZieWJ5dG92dHZuYnpxemRrYnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NDcwMDksImV4cCI6MjA4ODIyMzAwOX0.c_yz32JG70ACef6Mud5OFnUCunwZ3G9Djdp-uIlDxVw\n");
    // Debugging SSR env vars
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    // Use more robust check for missing environment variables
    const isMissing = !url || url === 'undefined' || !key || key === 'undefined';
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createBrowserClient$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBrowserClient"])(url, key);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/production/dad-strength-app/src/contexts/UserContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "UserProvider",
    ()=>UserProvider,
    "useUser",
    ()=>useUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$utils$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/src/utils/supabase/client.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
const UserContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])({
    user: null,
    loading: true
});
function UserProvider({ children }) {
    _s();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "UserProvider.useEffect": ()=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$utils$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createClient"])();
            // Get initial session (fast — reads from localStorage cache)
            supabase.auth.getSession().then({
                "UserProvider.useEffect": (r)=>{
                    setUser(r.data.session?.user ?? null);
                    setLoading(false);
                }
            }["UserProvider.useEffect"]);
            // Keep in sync with auth state changes (login / logout / token refresh)
            const { data: { subscription } } = supabase.auth.onAuthStateChange({
                "UserProvider.useEffect": (_event, session)=>{
                    setUser(session?.user ?? null);
                    setLoading(false);
                }
            }["UserProvider.useEffect"]);
            return ({
                "UserProvider.useEffect": ()=>subscription.unsubscribe()
            })["UserProvider.useEffect"];
        }
    }["UserProvider.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(UserContext.Provider, {
        value: {
            user,
            loading
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/production/dad-strength-app/src/contexts/UserContext.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_s(UserProvider, "NiO5z6JIqzX62LS5UWDgIqbZYyY=");
_c = UserProvider;
function useUser() {
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(UserContext);
}
_s1(useUser, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
var _c;
__turbopack_context__.k.register(_c, "UserProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/production/dad-strength-app/src/contexts/ThemeContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ThemeProvider",
    ()=>ThemeProvider,
    "useTheme",
    ()=>useTheme
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
const ThemeContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])({
    theme: 'auto',
    setTheme: ()=>{},
    resolvedTheme: 'dark'
});
function useTheme() {
    _s();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(ThemeContext);
}
_s(useTheme, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
function getSystemPreference() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyToDOM(resolved) {
    const html = document.documentElement;
    if (resolved === 'dark') {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
}
function ThemeProvider({ children }) {
    _s1();
    const [theme, setThemeState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('auto');
    const [resolvedTheme, setResolvedTheme] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('dark');
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const resolve = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "ThemeProvider.useCallback[resolve]": (t)=>{
            return t === 'auto' ? getSystemPreference() : t;
        }
    }["ThemeProvider.useCallback[resolve]"], []);
    // Mount: read saved preference and apply immediately
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeProvider.useEffect": ()=>{
            const saved = localStorage.getItem('dad-strength-theme');
            const initial = saved && [
                'dark',
                'light',
                'auto'
            ].includes(saved) ? saved : 'auto';
            const resolved = resolve(initial);
            setThemeState(initial);
            setResolvedTheme(resolved);
            applyToDOM(resolved);
            setMounted(true);
        }
    }["ThemeProvider.useEffect"], [
        resolve
    ]);
    // When theme changes after mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeProvider.useEffect": ()=>{
            if (!mounted) return;
            const resolved = resolve(theme);
            setResolvedTheme(resolved);
            applyToDOM(resolved);
        }
    }["ThemeProvider.useEffect"], [
        theme,
        mounted,
        resolve
    ]);
    // Listen for OS preference changes when in auto mode
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ThemeProvider.useEffect": ()=>{
            if (!mounted) return;
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = {
                "ThemeProvider.useEffect.handler": ()=>{
                    if (theme === 'auto') {
                        const resolved = getSystemPreference();
                        setResolvedTheme(resolved);
                        applyToDOM(resolved);
                    }
                }
            }["ThemeProvider.useEffect.handler"];
            mq.addEventListener('change', handler);
            return ({
                "ThemeProvider.useEffect": ()=>mq.removeEventListener('change', handler)
            })["ThemeProvider.useEffect"];
        }
    }["ThemeProvider.useEffect"], [
        theme,
        mounted
    ]);
    const setTheme = (t)=>{
        setThemeState(t);
        localStorage.setItem('dad-strength-theme', t);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ThemeContext.Provider, {
        value: {
            theme,
            resolvedTheme,
            setTheme
        },
        children: children
    }, void 0, false, {
        fileName: "[project]/production/dad-strength-app/src/contexts/ThemeContext.tsx",
        lineNumber: 86,
        columnNumber: 5
    }, this);
}
_s1(ThemeProvider, "AxSBBj8YkwpUZhsTX7/TgsXGmUQ=");
_c = ThemeProvider;
var _c;
__turbopack_context__.k.register(_c, "ThemeProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/production/dad-strength-app/src/contexts/SubscriptionContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SubscriptionProvider",
    ()=>SubscriptionProvider,
    "useSubscription",
    ()=>useSubscription
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$utils$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/production/dad-strength-app/src/utils/supabase/client.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
const SubscriptionContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])({
    tier: 'free',
    isFounder: false,
    isPro: false,
    status: null,
    loading: true
});
function SubscriptionProvider({ children }) {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        tier: 'free',
        isFounder: false,
        isPro: false,
        status: null,
        loading: true
    });
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SubscriptionProvider.useEffect": ()=>{
            const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$src$2f$utils$2f$supabase$2f$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createClient"])();
            const load = {
                "SubscriptionProvider.useEffect.load": async ()=>{
                    const { data: { user } } = await supabase.auth.getUser();
                    if (!user) {
                        setState({
                            "SubscriptionProvider.useEffect.load": (s)=>({
                                    ...s,
                                    loading: false
                                })
                        }["SubscriptionProvider.useEffect.load"]);
                        return;
                    }
                    const { data: profile } = await supabase.from('user_profiles').select('subscription_tier, subscription_status, founder_pass').eq('id', user.id).maybeSingle();
                    const isFounder = profile?.founder_pass === true;
                    const isActivePro = profile?.subscription_tier === 'pro' && profile?.subscription_status === 'active';
                    const isPro = isFounder || isActivePro;
                    setState({
                        tier: isPro ? 'pro' : 'free',
                        isFounder,
                        isPro,
                        status: profile?.subscription_status ?? null,
                        loading: false
                    });
                }
            }["SubscriptionProvider.useEffect.load"];
            load();
            // Refresh on auth state change (login/logout)
            const { data: { subscription } } = supabase.auth.onAuthStateChange({
                "SubscriptionProvider.useEffect": ()=>{
                    load();
                }
            }["SubscriptionProvider.useEffect"]);
            return ({
                "SubscriptionProvider.useEffect": ()=>subscription.unsubscribe()
            })["SubscriptionProvider.useEffect"];
        }
    }["SubscriptionProvider.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SubscriptionContext.Provider, {
        value: state,
        children: children
    }, void 0, false, {
        fileName: "[project]/production/dad-strength-app/src/contexts/SubscriptionContext.tsx",
        lineNumber: 73,
        columnNumber: 5
    }, this);
}
_s(SubscriptionProvider, "oWURIYPpAutiYvSGACqWY+jZr5o=");
_c = SubscriptionProvider;
function useSubscription() {
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$production$2f$dad$2d$strength$2d$app$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(SubscriptionContext);
}
_s1(useSubscription, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
var _c;
__turbopack_context__.k.register(_c, "SubscriptionProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=production_dad-strength-app_src_f5d4da08._.js.map