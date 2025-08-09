'use client';

import React, { useEffect, useState } from 'react';

export interface ThemeItem {
  id: number;
  title: string;
  description: string;
}

interface ThemeListProps {
  onThemeSelect: (theme: ThemeItem) => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ThemeList({ onThemeSelect }: ThemeListProps) {
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchThemes = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/themes`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data: ThemeItem[] = await response.json();
        setThemes(data);
      } catch (err: any) {
        setError(err.message || 'テーマの取得に失敗しました');
        console.error('Failed to fetch themes:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchThemes();
  }, []);

  if (isLoading) {
    return (
      <div className="theme-list-container">
        <div className="loading">📡 テーマを読み込み中...</div>
        <style jsx>{`
          .theme-list-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f8fafc;
          }
          .loading {
            font-size: 1.2rem;
            color: #64748b;
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="theme-list-container">
        <div className="error-container">
          <div className="error">❌ {error}</div>
          <button onClick={() => window.location.reload()} className="retry-button">
            再試行
          </button>
        </div>
        <style jsx>{`
          .theme-list-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: #f8fafc;
          }
          .error-container {
            text-align: center;
          }
          .error {
            background: #fef2f2;
            color: #dc2626;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 1rem;
            border: 1px solid #fecaca;
          }
          .retry-button {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.25rem;
            cursor: pointer;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="theme-list-container">
      <div className="header">
        <h1>🎨 会話テーマを選択してください</h1>
        <p>AIとどんな会話をしたいですか？テーマを選んでチャットを開始しましょう。</p>
      </div>

      <div className="themes-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            className="theme-card"
            onClick={() => onThemeSelect(theme)}
            aria-label={`テーマ選択: ${theme.title}`}
          >
            <div className="theme-title">{theme.title}</div>
            <div className="theme-description">{theme.description}</div>
            <div className="theme-action">チャットを開始 →</div>
          </button>
        ))}
      </div>

      <style jsx>{`
        .theme-list-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem;
        }

        .header {
          text-align: center;
          color: white;
          margin-bottom: 3rem;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .header h1 {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          font-weight: 700;
        }

        .header p {
          font-size: 1.2rem;
          opacity: 0.9;
          line-height: 1.6;
        }

        .themes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .theme-card {
          background: white;
          border: none;
          border-radius: 1rem;
          padding: 2rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }

        .theme-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }

        .theme-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #667eea, #764ba2);
        }

        .theme-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 0.75rem;
        }

        .theme-description {
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 1.5rem;
        }

        .theme-action {
          color: #3b82f6;
          font-weight: 500;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .theme-list-container {
            padding: 1rem;
          }
          
          .header h1 {
            font-size: 2rem;
          }
          
          .header p {
            font-size: 1rem;
          }
          
          .themes-grid {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          
          .theme-card {
            padding: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}