"use client";

import { useEffect, useState } from "react";
import type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
} from "pdfjs-dist/types/src/display/api";
import styles from "./page.module.css";

type RenderedPage = {
  id: number;
  dataUrl: string;
  aspectRatio: number;
  isCover?: boolean;
};

type PageProps = {
  page?: RenderedPage;
  loading: boolean;
};

const COVER_PATH = "/books/cover.jpg";
const FAIRYTALE_PATH = "/books/smallstory2.pdf";
const LOADING_IMAGE_PATH = "/books/loading.png";
const ANIMATION_DURATION = 260;

export default function Home() {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);
  const [theme, setTheme] = useState<"paper" | "night">("paper");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentPage = pages[pageIndex];

  const goTo = (next: number, dir: "next" | "prev") => {
    if (!pages.length) return;
    if (next < 0 || next >= pages.length) return;

    setSlideDir(dir);

    window.setTimeout(() => {
      setPageIndex(next);
      setSlideDir(null);
    }, ANIMATION_DURATION);
  };

  const goForward = () => {
    if (pageIndex < pages.length - 1) {
      goTo(pageIndex + 1, "next");
    }
  };

  const goBackward = () => {
    if (pageIndex > 0) {
      goTo(pageIndex - 1, "prev");
    }
  };

  const handleTap = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!pages.length) return;
    const { left, width } = event.currentTarget.getBoundingClientRect();
    const midpoint = left + width / 2;
    if (event.clientX < midpoint) goBackward();
    else goForward();
  };

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    const renderPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        loadingTask = pdfjs.getDocument(FAIRYTALE_PATH);
        const pdf: PDFDocumentProxy = await loadingTask.promise;

        const rendered: RenderedPage[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;

          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) throw new Error("Canvas context not available");

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page
            .render({
              canvasContext: ctx,
              viewport,
              canvas,
            })
            .promise;

          rendered.push({
            id: i,
            dataUrl: canvas.toDataURL("image/png"),
            aspectRatio: viewport.width / viewport.height,
          });
        }

        if (!cancelled) {
          const firstAspect = rendered[0]?.aspectRatio ?? 1.4;

          const cover: RenderedPage = {
            id: 0,
            dataUrl: COVER_PATH,
            aspectRatio: firstAspect,
            isCover: true,
          };

          setPages([cover, ...rendered]);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load PDF.");
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goForward();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goBackward();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [pageIndex, pages.length]);

  return (
    <div
      className={`${styles.shell} ${
        theme === "night" ? styles.night : styles.paper
      }`}
    >
      <header className={styles.header}>
        <div className={styles.meta}>
          <span>
            Spread {pageIndex + 1} / {pages.length}
          </span>

          <div className={styles.themeToggle}>
            <button
              type="button"
              className={theme === "paper" ? styles.active : undefined}
              onClick={() => setTheme("paper")}
            >
              ☀︎ Off White
            </button>
            <button
              type="button"
              className={theme === "night" ? styles.active : undefined}
              onClick={() => setTheme("night")}
            >
              ☾ Black
            </button>
          </div>
        </div>
      </header>

      <section className={styles.stage} onClick={handleTap}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingInner}>
              <img
                src={LOADING_IMAGE_PATH}
                alt="Loading"
                className={styles.loadingImage}
              />
              <p className={styles.loadingText}>Loading…</p>
            </div>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.book}>
          <div
            className={`${styles.page} ${
              slideDir === "next"
                ? styles.slideNext
                : slideDir === "prev"
                ? styles.slidePrev
                : ""
            }`}
          >
            <PageContent page={currentPage ?? undefined} loading={loading} />
          </div>
        </div>

        {!loading && !error && (
          <p className={styles.helperText}>Tap left/right or use ← →</p>
        )}
      </section>
    </div>
  );
}

function PageContent({ page, loading }: PageProps) {
  if (loading) return null; 
  if (!page) return <span className={styles.blankPage}>No more pages</span>;

  const isCover = page.isCover === true;

  return (
    <div className={styles.pageInner}>
      <div className={isCover ? styles.coverImageWrap : styles.imageWrap}>
        <img src={page.dataUrl} alt={`Page ${page.id}`} />
      </div>
    </div>
  );
}