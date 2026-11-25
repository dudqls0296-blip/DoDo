@echo off
chcp 65001 >nul
title 고민저장소
cd /d "%~dp0"
echo.
echo   고민저장소를 시작합니다. 잠시 뒤 브라우저가 열려요.
echo   이 창을 닫으면 사이트도 종료돼요.
echo.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8787"
where node >nul 2>nul
if %errorlevel%==0 (
  node server\index.mjs
) else (
  echo   Node.js가 없어 간단 서버로 실행해요. 노래 재생은 되지만 AI 상담은 내장 질문으로 진행돼요.
  echo   AI까지 쓰려면 https://nodejs.org 에서 Node.js를 설치하고 .env 에 키를 넣어주세요.
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\serve.ps1"
)
pause
