@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Site Kapısı Otomasyonu
echo ======================================================
echo   Site Kapısı Otomasyonu Başlatılıyor...
echo   (Hiçbir ek indirme gerekmeden hemen açılır)
echo ======================================================
node sunucu.js
pause
