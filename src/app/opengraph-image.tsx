import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "香港房产成本分析器 - 买房 vs 租房 真实成本对比";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #faf6f0 0%, #f5f0e8 50%, #ebe5da 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              fontWeight: 600,
              color: "#0d9488",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            HK Property Analyzer
          </div>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 800,
              color: "#18181b",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            香港房产成本分析器
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#71717a",
              textAlign: "center",
              maxWidth: "800px",
              lineHeight: 1.5,
            }}
          >
            自住买房 vs 租房 · 以租养房投资回报
          </div>
          <div
            style={{
              display: "flex",
              gap: "16px",
              marginTop: "16px",
            }}
          >
            {["TCO/TCR 对比", "盈亏平衡分析", "多年趋势", "敏感度分析"].map(
              (tag) => (
                <div
                  key={tag}
                  style={{
                    background: "#0d948820",
                    color: "#0d9488",
                    padding: "8px 20px",
                    borderRadius: "999px",
                    fontSize: "18px",
                    fontWeight: 600,
                  }}
                >
                  {tag}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
