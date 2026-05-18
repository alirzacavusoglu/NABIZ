@echo off
echo ===================================================
echo 🚀 NABIZ KOMUTA MERKEZI: TUM SISTEMLER ATESLENIYOR...
echo ===================================================

echo [1/2] Frontend (Next.js) sunucusu ayaga kaldiriliyor...
:: start cmd /k komutu yeni bir terminal açar ve npm komutunu orada kilitlenmeden çalıştırır.
:: "proje-frontend" yazan yer senin Next.js klasörünün adıdır, eğer farklıysa orayı düzelt.
start cmd /k "cd proje-frontend && npm run dev -- -H 0.0.0.0"

echo [2/2] Backend (Python/Uvicorn) sanal ortami baslatiliyor...
call venv\Scripts\activate.bat
uvicorn main:app --host 0.0.0.0 --port 8000 --reload