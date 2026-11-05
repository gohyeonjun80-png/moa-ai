
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./App.css";
import "./App-auth.css";

// ======================================
// MOA AI — FINAL VERSION
// React + Vite + Supabase + Express
// URL 자동 수집 + AI 검색
// ======================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000";

type Content = {
  id: number;
  user_id?: string;
  title: string;
  url: string | null;
  description: string | null;
  category: string | null;
  source: string | null;
  tags: string[] | null;
  content_type: string | null;
  summary: string | null;
  created_at: string;
  thumbnail_url?: string | null;
  author_name?: string | null;
  metadata_status?: string | null;
};

type Tab = "home" | "library" | "search" | "my";

type SearchFilters = {
  platform: string;
  start_date: string;
  end_date: string;
  keywords: string[];
};

type Metadata = {
  title: string;
  url: string;
  description: string;
  thumbnail_url: string;
  author_name: string;
  platform: string;
};

type Classification = {
  category: string;
  content_type: string;
  tags: string[];
  summary: string;
};

// ======================================
// 공통 함수
// ======================================

function validUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" ||
      u.protocol === "https:";
  } catch {
    return false;
  }
}

function youtubeId(value: string): string | null {
  if (!validUrl(value)) return null;

  const u = new URL(value);
  const host = u.hostname.toLowerCase();
  let id: string | null = null;

  if (host === "youtu.be") {
    id = u.pathname.split("/")[1] || null;
  } else if (
    host === "youtube.com" ||
    host.endsWith(".youtube.com")
  ) {
    const parts = u.pathname.split("/");

    if (u.pathname === "/watch") {
      id = u.searchParams.get("v");
    } else if (
      ["shorts", "embed", "live"].includes(parts[1])
    ) {
      id = parts[2] || null;
    }
  }

  return /^[a-zA-Z0-9_-]{11}$/.test(id || "")
    ? id
    : null;
}

function detectPlatform(
  item: Pick<Content, "url" | "source">
): string {
  const source = (item.source || "").toLowerCase();

  try {
    const host = new URL(item.url || "")
      .hostname.toLowerCase();

    if (
      host === "youtu.be" ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com")
    ) return "youtube";

    if (
      host === "instagram.com" ||
      host.endsWith(".instagram.com")
    ) return "instagram";

    if (
      host === "naver.com" ||
      host.endsWith(".naver.com") ||
      host === "naver.me"
    ) return "naver";

    if (
      host === "kakao.com" ||
      host.endsWith(".kakao.com") ||
      host === "kko.to"
    ) return "kakao";
  } catch {
    // URL이 없는 경우 source 확인
  }

  if (source.includes("youtube") ||
      source.includes("유튜브")) return "youtube";

  if (source.includes("instagram") ||
      source.includes("인스타")) return "instagram";

  if (source.includes("naver") ||
      source.includes("네이버")) return "naver";

  if (source.includes("kakao") ||
      source.includes("카카오")) return "kakao";

  return "other";
}

function platformName(value: string): string {
  const names: Record<string, string> = {
    youtube: "유튜브",
    instagram: "인스타그램",
    naver: "네이버",
    kakao: "카카오",
    other: "기타",
  };

  return names[value] || "기타";
}

function platformIcon(value: string): string {
  const icons: Record<string, string> = {
    youtube: "▶",
    instagram: "◎",
    naver: "N",
    kakao: "●",
    other: "✦",
  };

  return icons[value] || "✦";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "날짜 없음";
  }

  return date.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function koreanDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(date);

  const find = (name: string) =>
    parts.find((p) => p.type === name)?.value || "";

  return [
    find("year"),
    find("month"),
    find("day"),
  ].join("-");
}

function contentText(item: Content): string {
  return [
    item.title,
    item.description,
    item.summary,
    item.category,
    item.content_type,
    item.author_name,
    ...(item.tags || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ======================================
// 로그인 / 회원가입
// ======================================

function AuthScreen() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    if (busy) return;

    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (signup && password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setBusy(true);

    try {
      if (signup) {
        const { data, error: err } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

        if (err) throw err;

        if (!data.session) {
          setMessage(
            "회원가입되었습니다. 이메일 인증 후 로그인하세요."
          );
          setSignup(false);
          setPassword("");
          setConfirm("");
        }
      } else {
        const { error: err } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (err) throw err;
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "인증 오류가 발생했습니다."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <main className="auth-card">
        <div className="auth-brand">
          <div
            style={{
              width: 65,
              height: 65,
              margin: "0 auto 18px",
              borderRadius: 20,
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg,#386ce8,#7661e9)",
              color: "white",
              fontSize: 30,
            }}
          >
            ✦
          </div>

          <p className="auth-kicker">
            YOUR PERSONAL AI LIBRARY
          </p>

          <h1>
            {signup ? "모아의 시작" : "다시 만나요"}
          </h1>

          <p>
            모든 영감을 하나의 공간에.
          </p>
        </div>

        <div className="auth-mode-switch">
          <button
            type="button"
            className={!signup ? "active" : ""}
            onClick={() => {
              setSignup(false);
              setError("");
              setMessage("");
            }}
          >
            로그인
          </button>

          <button
            type="button"
            className={signup ? "active" : ""}
            onClick={() => {
              setSignup(true);
              setError("");
              setMessage("");
            }}
          >
            회원가입
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            minLength={6}
            autoComplete={
              signup ? "new-password" : "current-password"
            }
            placeholder="6자 이상 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {signup && (
            <>
              <label htmlFor="confirm">
                비밀번호 확인
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </>
          )}

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="auth-success" role="status">
              {message}
            </p>
          )}

          <button
            className="auth-submit"
            disabled={busy}
            type="submit"
          >
            {busy
              ? "처리 중..."
              : signup
                ? "회원가입하기 →"
                : "로그인하기 →"}
          </button>
        </form>

        <div className="auth-bottom-note">
          ✦ 당신만의 콘텐츠 공간, MOA AI
        </div>
      </main>
    </div>
  );
}

// ======================================
// 메인 앱
// ======================================

function App() {
  // 인증
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // 화면
  const [tab, setTab] = useState<Tab>("home");
  const [contents, setContents] = useState<Content[]>([]);
  const [selectedContent, setSelectedContent] =
    useState<Content | null>(null);

  // 저장 폼
  const [showSave, setShowSave] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // URL 메타데이터
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [metadataLoading, setMetadataLoading] =
    useState(false);
  const [metadataMessage, setMetadataMessage] =
    useState("");

  // 이전 요청과 응답 구분
  const metadataRequest = useRef(0);
  const currentUrl = useRef("");
  const attemptedUrl = useRef("");

  // 보관함
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("전체");

  // AI 검색
  const [aiSearch, setAiSearch] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [searchResults, setSearchResults] =
    useState<Content[]>([]);
  const [searchMessage, setSearchMessage] = useState("");

  // 알림
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // --------------------------------------
  // 로그인 상태
  // --------------------------------------

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setUser(data.session?.user || null);
        setAuthLoading(false);
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setAuthLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        setUser(session?.user || null);
        setAuthLoading(false);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // --------------------------------------
  // Supabase 콘텐츠 목록
  // --------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function fetchItems(userId: string) {
      setLoading(true);

      const { data, error: err } = await supabase
        .from("contents")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (err) {
        setError(err.message);
      } else {
        setContents((data || []) as Content[]);
      }

      setLoading(false);
    }

    if (user) {
      void fetchItems(user.id);
    } else {
      setContents([]);
      setSearchResults([]);
      setSelectedContent(null);
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function reloadContents() {
    if (!user) return;

    const { data, error: err } = await supabase
      .from("contents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      return;
    }

    setContents((data || []) as Content[]);
  }

  async function getToken() {
    const { data, error: err } =
      await supabase.auth.getSession();

    if (err || !data.session) {
      throw new Error("로그인이 필요합니다.");
    }

    return data.session.access_token;
  }

  // --------------------------------------
  // URL 변경
  // --------------------------------------

  function changeUrl(value: string) {
    metadataRequest.current += 1;
    currentUrl.current = value.trim();
    attemptedUrl.current = "";

    setUrl(value);
    setThumbnailUrl("");
    setAuthorName("");
    setMetadataUrl("");
    setMetadataMessage("");
    setMetadataLoading(false);
  }

useEffect(() => {
  if (!user) return;

  const params = new URLSearchParams(
    window.location.search
  );

  // PWA 공유 데이터가 없다면 종료
  if (
    !params.has("url") &&
    !params.has("text") &&
    !params.has("title")
  ) {
    return;
  }

  const sharedTitle = params.get("title") || "";
  const sharedText = params.get("text") || "";
  const sharedUrl = params.get("url") || "";

  // 공유된 문자열에서 URL 찾기
  function extractUrl(text: string) {
    const match = text.match(/https?:\/\/[^\s<>]+/i);

    return match
      ? match[0].replace(/[),.;!?]+$/, "")
      : "";
  }

  const finalUrl =
    extractUrl(sharedUrl) ||
    extractUrl(sharedText) ||
    extractUrl(sharedTitle);

  if (!validUrl(finalUrl)) {
    setError("공유된 URL이 올바르지 않습니다.");
    return;
  }

  // 기존 14단계 URL 변경 함수
  changeUrl(finalUrl);

  setTitle(
    sharedTitle === finalUrl
      ? ""
      : sharedTitle.slice(0, 300)
  );

  setDescription(
    sharedText.replace(finalUrl, "").trim().slice(0, 5000)
  );

  setTab("home");
  setShowSave(true);

  setNotice(
    "공유된 링크를 받았습니다. 확인 후 저장해 주세요."
  );

  // 공유 데이터 처리 후 주소창 정리
  params.delete("url");
  params.delete("title");
  params.delete("text");

  const remaining = params.toString();

  window.history.replaceState(
    {},
    "",
    window.location.pathname +
      (remaining ? `?${remaining}` : "") +
      window.location.hash
  );

// 기존 changeUrl 함수 사용
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [user?.id]);

  // --------------------------------------
  // 14단계: URL 메타데이터 수집
  // --------------------------------------

  async function fetchMetadata(target: string) {
    const clean = target.trim();

    if (!validUrl(clean)) {
      setMetadataMessage("올바른 URL을 입력해 주세요.");
      return;
    }

    if (!youtubeId(clean)) {
      setMetadataMessage(
        "현재 유튜브 영상 URL만 자동 수집합니다. 다른 플랫폼은 제목을 직접 입력해 주세요."
      );
      return;
    }

    if (!user) return;

    // 같은 URL의 자동 재요청 방지
    if (metadataLoading || attemptedUrl.current === clean) {
      return;
    }

    attemptedUrl.current = clean;
    const requestId = ++metadataRequest.current;

    setMetadataLoading(true);
    setMetadataMessage("");

    try {
      const token = await getToken();

      const response = await fetch(
        `${API_URL}/api/metadata`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: clean }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.metadata) {
        throw new Error(
          result.error || "영상 정보를 불러오지 못했습니다."
        );
      }

      // 사용자가 URL을 바꿨다면 결과 무시
      if (
        requestId !== metadataRequest.current ||
        currentUrl.current !== clean
      ) {
        return;
      }

      const info = result.metadata as Metadata;

      setTitle(info.title || "");
      setThumbnailUrl(info.thumbnail_url || "");
      setAuthorName(info.author_name || "");

      if (info.description) {
        setDescription(info.description);
      }

      setMetadataUrl(clean);
      setMetadataMessage(
        "✓ 영상 제목, 채널명, 썸네일을 가져왔습니다."
      );
    } catch (err) {
      if (requestId !== metadataRequest.current) {
        return;
      }

      setMetadataMessage(
        err instanceof Error
          ? err.message
          : "메타데이터 수집 오류"
      );
    } finally {
      if (requestId === metadataRequest.current) {
        setMetadataLoading(false);
      }
    }
  }

  // URL 입력 후 800ms 자동 조회
  useEffect(() => {
    if (!user || !showSave) return;

    const value = url.trim();

    if (!youtubeId(value)) return;
    if (metadataUrl === value) return;
    if (attemptedUrl.current === value) return;

    const timer = window.setTimeout(() => {
      void fetchMetadata(value);
    }, 800);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, user?.id, showSave, metadataUrl]);

  // --------------------------------------
  // 저장 폼 관리
  // --------------------------------------

  function openSaveForm() {
    setTab("home");
    setShowSave(true);
    setError("");
    setNotice("");
  }

  function resetSaveForm() {
    metadataRequest.current += 1;
    currentUrl.current = "";
    attemptedUrl.current = "";

    setTitle("");
    setUrl("");
    setDescription("");
    setThumbnailUrl("");
    setAuthorName("");
    setMetadataUrl("");
    setMetadataMessage("");
    setMetadataLoading(false);
    setShowSave(false);
  }

  // --------------------------------------
  // AI 분류 및 콘텐츠 저장
  // --------------------------------------

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!user || saving) return;

    const cleanTitle = title.trim();
    const cleanUrl = url.trim();
    const cleanDescription = description.trim();

    if (!cleanTitle) {
      setError("제목을 입력해 주세요.");
      return;
    }

    if (cleanTitle.length > 300 ||
        cleanUrl.length > 2048 ||
        cleanDescription.length > 5000) {
      setError("입력 글자 수를 확인해 주세요.");
      return;
    }

    if (cleanUrl && !validUrl(cleanUrl)) {
      setError("올바른 URL을 입력해 주세요.");
      return;
    }

    if (metadataLoading) {
      setError("영상 정보 조회가 끝난 후 저장하세요.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    const platform = detectPlatform({
      url: cleanUrl,
      source: null,
    });

    const validMetadata =
      !!cleanUrl && metadataUrl === cleanUrl;

    let classification: Classification = {
      category: "기타",
      content_type: "기타",
      tags: [],
      summary: "AI 분석이 완료되지 않았습니다.",
    };

    let warning = "";

    // OpenAI 분석
    try {
      const token = await getToken();

      const response = await fetch(
        `${API_URL}/api/classify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: cleanTitle,
            url: cleanUrl,
            description: cleanDescription,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.classification) {
        throw new Error(result.error || "AI 분류 실패");
      }

      const ai = result.classification;

      classification = {
        category:
          typeof ai.category === "string"
            ? ai.category
            : "기타",
        content_type:
          typeof ai.content_type === "string"
            ? ai.content_type
            : "기타",
        tags: Array.isArray(ai.tags)
          ? ai.tags.filter(
              (tag: unknown): tag is string =>
                typeof tag === "string"
            ).slice(0, 5)
          : [],
        summary:
          typeof ai.summary === "string"
            ? ai.summary
            : "요약 없음",
      };
    } catch (err) {
      console.error("AI 분류 오류:", err);
      warning = "AI 분석 없이 콘텐츠가 저장되었습니다.";
    }

    // Supabase 저장
    try {
      const { error: saveError } = await supabase
        .from("contents")
        .insert({
          user_id: user.id,
          title: cleanTitle,
          url: cleanUrl || null,
          description: cleanDescription || null,
          source: platform,
          category: classification.category,
          content_type: classification.content_type,
          tags: classification.tags,
          summary: classification.summary,
          thumbnail_url: validMetadata
            ? thumbnailUrl || null
            : null,
          author_name: validMetadata
            ? authorName || null
            : null,
          metadata_status: validMetadata
            ? "completed"
            : "pending",
        });

      if (saveError) throw saveError;

      resetSaveForm();
      await reloadContents();

      setNotice(
        warning || "✓ 콘텐츠를 저장했습니다."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `저장 실패: ${err.message}`
          : "콘텐츠 저장 오류"
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------
  // 콘텐츠 삭제
  // --------------------------------------

  async function handleDelete(id: number) {
    if (!user) return false;

    if (!window.confirm("이 콘텐츠를 삭제할까요?")) {
      return false;
    }

    const { error: err } = await supabase
      .from("contents")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (err) {
      setError(err.message);
      return false;
    }

    setContents((prev) =>
      prev.filter((item) => item.id !== id)
    );

    setSearchResults((prev) =>
      prev.filter((item) => item.id !== id)
    );

    setSelectedContent(null);
    setNotice("콘텐츠를 삭제했습니다.");
    return true;
  }

  // --------------------------------------
  // 로그아웃
  // --------------------------------------

  async function handleLogout() {
    if (!window.confirm("로그아웃할까요?")) return;

    setSigningOut(true);

    try {
      const { error: err } = await supabase.auth.signOut();

      if (err) throw err;

      setContents([]);
      setSearchResults([]);
      setSelectedContent(null);
      setTab("home");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "로그아웃에 실패했습니다."
      );
    } finally {
      setSigningOut(false);
    }
  }

  // --------------------------------------
  // 보관함 검색
  // --------------------------------------

  const platformFilters: Record<string, string> = {
    "유튜브": "youtube",
    "인스타그램": "instagram",
    "네이버": "naver",
    "카카오": "kakao",
    "기타": "other",
  };

  const filteredContents = contents.filter((item) => {
    const keyword = search.trim().toLowerCase();

    const matchesText =
      !keyword || contentText(item).includes(keyword);

    const matchesPlatform =
      category === "전체" ||
      detectPlatform(item) === platformFilters[category];

    return matchesText && matchesPlatform;
  });

  const recentContents = contents.slice(0, 3);

  // --------------------------------------
  // AI 자연어 검색
  // --------------------------------------

  async function handleAiSearch() {
    const query = aiSearch.trim();

    if (!query) {
      setSearchMessage("검색어를 입력해 주세요.");
      setSearchResults([]);
      return;
    }

    if (!user || aiBusy) return;

    if (loading || contents.length === 0) {
      setSearchMessage(
        loading
          ? "콘텐츠를 불러오는 중입니다."
          : "저장된 콘텐츠가 없습니다."
      );
      setSearchResults([]);
      return;
    }

    setAiBusy(true);
    setSearchResults([]);
    setSearchMessage("");

    try {
      const token = await getToken();

      const response = await fetch(
        `${API_URL}/api/search-parse`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ query }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.filters) {
        throw new Error(
          result.error || "검색 조건 분석 실패"
        );
      }

      const filters = result.filters as SearchFilters;

      const matches = contents.filter((item) => {
        const platformMatches =
          filters.platform === "all" ||
          detectPlatform(item) === filters.platform;

        const savedDate = koreanDate(item.created_at);

        const dateMatches =
          (!filters.start_date ||
            savedDate >= filters.start_date) &&
          (!filters.end_date ||
            savedDate <= filters.end_date);

        const words = Array.isArray(filters.keywords)
          ? filters.keywords
          : [];

        const text = contentText(item);

        const keywordMatches =
          words.length === 0 ||
          words.some((word) =>
            text.includes(word.toLowerCase())
          );

        return (
          platformMatches &&
          dateMatches &&
          keywordMatches
        );
      });

      setSearchResults(matches);
      setSearchMessage(
        matches.length
          ? `${matches.length}개의 콘텐츠를 찾았습니다.`
          : "조건에 맞는 콘텐츠가 없습니다."
      );
    } catch (err) {
      setSearchMessage(
        err instanceof Error
          ? err.message
          : "AI 검색 오류가 발생했습니다."
      );
    } finally {
      setAiBusy(false);
    }
  }

  // --------------------------------------
  // 콘텐츠 카드
  // --------------------------------------

  function contentCard(item: Content) {
    const platform = detectPlatform(item);

    return (
      <article className="content-card" key={item.id}>
        <div className="content-thumbnail">
          {item.thumbnail_url &&
          validUrl(item.thumbnail_url) ? (
            <img
              src={item.thumbnail_url}
              alt={`${item.title} 썸네일`}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span className="thumbnail-symbol">
              {platformIcon(platform)}
            </span>
          )}

          <span className="thumbnail-category">
            {item.category || "기타"}
          </span>
        </div>

        <div className="content-card-body">
          <h3>{item.title}</h3>

          <p>
            {item.summary ||
              item.description ||
              "설명이 없습니다."}
          </p>

          {item.author_name && (
            <p style={{ fontSize: 12, color: "#8792ad" }}>
              {item.author_name}
            </p>
          )}

          <div className="content-card-bottom">
            <span>{formatDate(item.created_at)}</span>

            <div className="card-actions">
              {item.url && validUrl(item.url) && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  열기 ↗
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  void handleDelete(item.id);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  // --------------------------------------
  // 인증 로딩 / 비로그인
  // --------------------------------------

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h2>MOA AI</h2>
          <p>로그인 상태를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  // ======================================
  // 화면 렌더링
  // ======================================

  return (
    <div className="app-shell">
      {/* 헤더 */}

      <header className="app-header">
        <div className="brand">
          
<img
  src="/moa-logo.png"
  alt="MOA AI"
  className="header-logo"
  style={{
    width: 45,
    height: 45,
    objectFit: "contain",
  }}
/>

          <span>moa AI</span>
        </div>

        <button
          type="button"
          className="notification-button"
          onClick={() => setTab("my")}
          aria-label="마이페이지"
        >
          ♙
        </button>
      </header>

      <main className="app-main">
        {/* 전역 알림 */}

        {notice && (
          <div
            role="status"
            style={{
              padding: 14,
              marginBottom: 15,
              borderRadius: 12,
              background: "#eff5ff",
              color: "#386ce8",
            }}
          >
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              style={{ float: "right" }}
            >
              ×
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: 14,
              marginBottom: 15,
              borderRadius: 12,
              background: "#fff1f3",
              color: "#c3475d",
            }}
          >
            {error}
            <button
              type="button"
              onClick={() => setError("")}
              style={{ float: "right" }}
            >
              ×
            </button>
          </div>
        )}

        {/* ==============================
            HOME
        ============================== */}

        {tab === "home" && (
          <>
            <section className="home-intro">
              <p className="eyebrow">
                YOUR PERSONAL AI LIBRARY
              </p>
              <h1>
                모든 영감을,
                <br />
                하나의 공간에.
              </h1>
              <p>
                흩어진 콘텐츠를 모으고,
                <br />
                AI로 더 쉽게 찾아보세요.
              </p>
            </section>

            <section className="main-search">
              <span>⌕</span>
              <input
                placeholder="어떤 콘텐츠를 찾고 계신가요?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setTab("library");
                }}
              />
              <button
                type="button"
                onClick={() => setTab("library")}
              >
                ⌕
              </button>
            </section>

            <section className="source-list">
              {[
                ["youtube", "유튜브"],
                ["instagram", "인스타"],
                ["naver", "네이버"],
                ["other", "더보기"],
              ].map(([platform, name]) => (
                <button
                  type="button"
                  key={platform}
                  onClick={openSaveForm}
                >
                  <span
                    className={`source-icon ${
                      platform === "other"
                        ? "more"
                        : platform
                    }`}
                  >
                    {platformIcon(platform)}
                  </span>
                  <span>{name}</span>
                </button>
              ))}
            </section>

            <button
              type="button"
              className="smart-save-banner"
              onClick={openSaveForm}
            >
              <span className="banner-sparkle">✦</span>
              <span className="banner-text">
                <strong>AI 스마트 수집</strong>
                <small>
                  링크를 저장하면 AI가 분석하고
                  자동으로 정리합니다.
                </small>
              </span>
              <span className="banner-arrow">›</span>
            </button>

            {/* URL 저장 폼 */}

            {showSave && (
              <section className="save-panel">
                <div className="save-panel-heading">
                  <h2>새 콘텐츠 저장</h2>
                  <button
                    type="button"
                    onClick={resetSaveForm}
                  >
                    ×
                  </button>
                </div>

                <form
                  className="save-form"
                  onSubmit={handleSave}
                >
                  <label htmlFor="save-url">
                    콘텐츠 URL
                  </label>

                  <input
                    id="save-url"
                    type="url"
                    placeholder="유튜브 영상 URL을 붙여넣으세요"
                    value={url}
                    onChange={(e) =>
                      changeUrl(e.target.value)
                      
                    }
                    
                    maxLength={2048}
                  />

                  <button
                    type="button"
                    disabled={
                      metadataLoading ||
                      !youtubeId(url)
                    }
                    onClick={() => {
                      // 실패한 URL 수동 재시도 허용
                      attemptedUrl.current = "";
                      void fetchMetadata(url);
                    }}
                  >
                    {metadataLoading
                      ? "영상 정보 불러오는 중..."
                      : "✦ 영상 정보 자동 가져오기"}
                  </button>

                  {metadataMessage && (
                    <p
                      className="metadata-message"
                      role="status"
                    >
                      {metadataMessage}
                    </p>
                  )}

                  {/* 썸네일 미리보기 */}

                  {thumbnailUrl && (
                    <div className="metadata-preview">
                      <img
                        src={thumbnailUrl}
                        alt="유튜브 영상 썸네일"
                      />
                      <div>
                        <strong>{title}</strong>
                        <p>{authorName}</p>
                      </div>
                    </div>
                  )}

                  <label htmlFor="save-title">
                    제목
                  </label>

                  <input
                    id="save-title"
                    placeholder="콘텐츠 제목"
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                    maxLength={300}
                    required
                  />

                  <label htmlFor="save-description">
                    설명 또는 메모
                  </label>

                  <textarea
                    id="save-description"
                    placeholder="콘텐츠에 관한 설명을 입력하세요"
                    value={description}
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
                    maxLength={5000}
                  />

                  <button
                    type="submit"
                    disabled={saving || metadataLoading}
                  >
                    {saving
                      ? "AI 분석 및 저장 중..."
                      : "✦ AI 자동분류 후 저장"}
                  </button>
                </form>
              </section>
            )}

            {/* 최근 저장 */}

            <section className="recent-section">
              <div className="section-heading">
                <h2>최근 저장한 콘텐츠</h2>
                <button
                  type="button"
                  onClick={() => setTab("library")}
                >
                  전체 보기 ›
                </button>
              </div>

              {loading ? (
                <p>콘텐츠를 불러오는 중...</p>
              ) : recentContents.length === 0 ? (
                <div className="empty-state">
                  <h3>아직 저장한 콘텐츠가 없습니다.</h3>
                  <p>첫 번째 콘텐츠를 저장해 보세요.</p>
                </div>
              ) : (
                <div className="recent-list">
                  {recentContents.map((item) => (
                    <div
                      key={item.id}
                      className="recent-item"
                    >
                      <div className="recent-image">
                        {item.thumbnail_url &&
                        validUrl(item.thumbnail_url) ? (
                          <img
                            src={item.thumbnail_url}
                            alt=""
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              borderRadius: 12,
                            }}
                          />
                        ) : (
                          platformIcon(detectPlatform(item))
                        )}
                      </div>

                      <div className="recent-info">
                        <strong>{item.title}</strong>
                        <span>
                          {platformName(
                            detectPlatform(item)
                          )}
                          {" · "}
                          {item.category || "기타"}
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label="콘텐츠 삭제"
                        onClick={() => {
                          void handleDelete(item.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {/* ==============================
            LIBRARY
        ============================== */}

        {tab === "library" && (
          <section className="library-page">
            <div className="page-heading">
              <span className="eyebrow">
                MY COLLECTION
              </span>
              <h1>내 보관함</h1>
              <p>
                저장한 콘텐츠를 한곳에서 관리하세요.
              </p>
            </div>

            <div className="library-toolbar">
              <input
                placeholder="제목, 설명, 태그 검색"
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

              <span className="content-count">
                {filteredContents.length}개
              </span>
            </div>

            <div className="category-tabs">
              {[
                "전체",
                "유튜브",
                "인스타그램",
                "네이버",
                "카카오",
                "기타",
              ].map((name) => (
                <button
                  type="button"
                  key={name}
                  className={
                    category === name ? "active" : ""
                  }
                  onClick={() => setCategory(name)}
                >
                  {name}
                </button>
              ))}
            </div>

            {loading ? (
              <p>불러오는 중...</p>
            ) : filteredContents.length === 0 ? (
              <div className="empty-state">
                <h3>콘텐츠가 없습니다.</h3>
                <p>
                  새로운 콘텐츠를 저장해 보세요.
                </p>
              </div>
            ) : (
              <div className="content-grid">
                {filteredContents.map(contentCard)}
              </div>
            )}

            <button
              type="button"
              className="floating-add-button"
              onClick={openSaveForm}
              aria-label="새 콘텐츠 추가"
            >
              +
            </button>
          </section>
        )}

        {/* ==============================
            AI SEARCH
        ============================== */}

        {tab === "search" && (
          <section className="search-page">
            {selectedContent ? (
              <div className="content-detail-page">
                <button
                  type="button"
                  onClick={() => setSelectedContent(null)}
                >
                  ← 검색 결과로 돌아가기
                </button>

                <div className="detail-thumbnail">
                  {selectedContent.thumbnail_url &&
                  validUrl(
                    selectedContent.thumbnail_url
                  ) ? (
                    <img
                      src={selectedContent.thumbnail_url}
                      alt={selectedContent.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 18,
                      }}
                    />
                  ) : (
                    <span>✦</span>
                  )}
                </div>

                <div className="detail-content">
                  <h1>{selectedContent.title}</h1>

                  <p>
                    {selectedContent.description ||
                      "설명이 없습니다."}
                  </p>

                  <div className="detail-info">
                    <div>
                      <span>AI 요약</span>
                      <strong>
                        {selectedContent.summary ||
                          "요약 없음"}
                      </strong>
                    </div>

                    <div>
                      <span>플랫폼</span>
                      <strong>
                        {platformName(
                          detectPlatform(
                            selectedContent
                          )
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>카테고리</span>
                      <strong>
                        {selectedContent.category ||
                          "기타"}
                      </strong>
                    </div>

                    <div>
                      <span>작성자</span>
                      <strong>
                        {selectedContent.author_name ||
                          "정보 없음"}
                      </strong>
                    </div>

                    <div>
                      <span>태그</span>
                      <strong>
                        {(selectedContent.tags || [])
                          .join(", ") || "없음"}
                      </strong>
                    </div>

                    <div>
                      <span>저장 날짜</span>
                      <strong>
                        {formatDate(
                          selectedContent.created_at
                        )}
                      </strong>
                    </div>
                  </div>

                  {selectedContent.url &&
                    validUrl(selectedContent.url) && (
                      <a
                        className="detail-open-button"
                        href={selectedContent.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        원본 콘텐츠 열기 ↗
                      </a>
                    )}

                  <button
                    type="button"
                    className="detail-delete-button"
                    onClick={() => {
                      void handleDelete(
                        selectedContent.id
                      );
                    }}
                  >
                    콘텐츠 삭제
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="page-heading">
                  <span className="eyebrow">
                    AI POWERED SEARCH
                  </span>

                  <h1>
                    기억나는 단서만으로,
                    <br />
                    찾아보세요.
                  </h1>

                  <p>
                    날짜, 플랫폼, 주제를 문장으로
                    검색하세요.
                  </p>
                </div>

                <div className="ai-search-box">
                  <input
                    value={aiSearch}
                    onChange={(e) =>
                      setAiSearch(e.target.value)
                    }
                    placeholder="3주 전 저장한 유튜브 영상"
                    maxLength={300}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        void handleAiSearch();
                      }
                    }}
                  />

                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => {
                      void handleAiSearch();
                    }}
                  >
                    {aiBusy ? "검색 중..." : "AI 검색"}
                  </button>
                </div>

                {searchMessage && (
                  <p
                    className="search-message"
                    role="status"
                  >
                    {searchMessage}
                  </p>
                )}

                {searchResults.length > 0 && (
                  <section className="search-results-section">
                    <div className="section-heading">
                      <h2>검색 결과</h2>
                      <span>
                        {searchResults.length}개
                      </span>
                    </div>

                    <div className="search-results-list">
                      {searchResults.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className="recent-item"
                          onClick={() =>
                            setSelectedContent(item)
                          }
                          style={{
                            width: "100%",
                            textAlign: "left",
                          }}
                        >
                          <div className="recent-image">
                            {item.thumbnail_url &&
                            validUrl(
                              item.thumbnail_url
                            ) ? (
                              <img
                                src={item.thumbnail_url}
                                alt=""
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                  borderRadius: 12,
                                }}
                              />
                            ) : (
                              platformIcon(
                                detectPlatform(item)
                              )
                            )}
                          </div>

                          <div className="recent-info">
                            <strong>{item.title}</strong>
                            <span>
                              {item.summary ||
                                formatDate(
                                  item.created_at
                                )}
                            </span>
                          </div>

                          <span>›</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <div className="search-suggestions">
                  <h3>이렇게 검색해 보세요</h3>

                  {[
                    "3주 전 저장한 유튜브 영상",
                    "어제 저장한 인스타그램 게시물",
                    "지난달 저장한 공부 자료",
                    "AI 관련 콘텐츠",
                  ].map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() =>
                        setAiSearch(suggestion)
                      }
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ==============================
            MY PAGE
        ============================== */}

        {tab === "my" && (
          <section className="my-page">
            <div className="page-heading">
              <span className="eyebrow">
                MY ACCOUNT
              </span>

              <h1>마이페이지</h1>

              <p>
                나만의 콘텐츠 라이브러리를
                관리하세요.
              </p>
            </div>

            <div className="profile-card">
              <div className="profile-icon">M</div>

              <div>
                <h2>MOA AI 사용자</h2>
                <p>{user.email}</p>
              </div>
            </div>

            <div className="my-stats">
              <div className="stat-card">
                <span>저장한 콘텐츠</span>
                <strong>{contents.length}</strong>
              </div>

              <div className="stat-card">
                <span>AI 분류 완료</span>
                <strong>
                  {
                    contents.filter(
                      (item) =>
                        item.summary &&
                        item.summary !==
                          "AI 분석이 완료되지 않았습니다."
                    ).length
                  }
                </strong>
              </div>
            </div>

            <div className="my-menu">
              <div className="my-menu-item">
                <div>
                  <strong>콘텐츠 관리</strong>
                  <p>저장한 콘텐츠 관리</p>
                </div>

                <button
                  type="button"
                  onClick={() => setTab("library")}
                >
                  확인하기
                </button>
              </div>

              <div className="my-menu-item">
                <div>
                  <strong>AI 검색</strong>
                  <p>스마트 콘텐츠 검색</p>
                </div>

                <button
                  type="button"
                  onClick={() => setTab("search")}
                >
                  검색하기
                </button>
              </div>
            </div>

            <button
              type="button"
              className="logout-button"
              disabled={signingOut}
              onClick={() => {
                void handleLogout();
              }}
            >
              {signingOut
                ? "로그아웃 중..."
                : "로그아웃"}
            </button>
          </section>
        )}
      </main>

      {/* 하단 메뉴 */}

      <nav
        className="bottom-nav"
        aria-label="메인 메뉴"
      >
        {[
          ["home", "⌂", "홈"],
          ["library", "▤", "보관함"],
          ["search", "✦", "AI 검색"],
          ["my", "♙", "마이"],
        ].map(([value, icon, label]) => (
          <button
            type="button"
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => {
              setTab(value as Tab);
              setSelectedContent(null);
            }}
          >
            <span>{icon}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
