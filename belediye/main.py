from google import genai
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import io
import json

app = FastAPI()

# CORS Ayarları (Next.js arayüzü ile iletişim için)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. API Anahtarı ve Gemini İstemcisi
API_KEY = "AIzaSyA0j0c9pJW-22zvUz_TtKjLYVitVhN-97Y"
client = genai.Client(api_key=API_KEY)

@app.get("/")
def read_root():
    return {"mesaj": "NABIZ Backend Başarıyla Çalışıyor! Kusursuz Master Versiyon Devrede."}

@app.post("/cukur-tespit/")
async def analyze_image(file: UploadFile = File(...)):
    try:
        # 2. Gelen Fotoğrafı Oku ve SIKIŞTIR 
        # (Bu sayede o 10053/10054 Windows ağ hatalarını bir daha asla görmeyeceksin. Görüntü saniyesinde Google'a uçacak!)
        request_object_content = await file.read()
        img = Image.open(io.BytesIO(request_object_content))
        img.thumbnail((800, 800))

        # 3. Optimize Edilmiş, Hızlı ve Akıllı Prompt (Diyete sokulmuş, süper hızlı çalışan versiyon)
        prompt = """
GÖREV: Fotoğrafı incele. GERÇEK bir kentsel/kamusal alan zararı varsa tespit et. 
SADECE JSON dön. Ek metin/markdown yazma.

KATEGORİLER: [yol_kaldirim, aydinlatma_enerji, temizlik_atik, park_yesilalan, su_kanalizasyon, trafik_sinyalizasyon, yapisal_tehlike]

KURALLAR:
1. GERÇEK SORUN VARSA: "is_issue_detected" değerini true yap. category ve severity seç.
2. SAHTE/OYUN/ÇİZİM İSE: "is_issue_detected" değerini false yap. category ve severity için null dön. description: "Sahte veya simülasyon görsel.", action_required: "Asılsız ihbar."
3. TEMİZ/SORUNSUZ İSE: "is_issue_detected" değerini false yap. category ve severity için null dön. description: "Sorun yok.", action_required: "Aksiyona gerek yok."

KUSURSUZ JSON FORMAT ÖRNEĞİ:
{
  "is_issue_detected": false,
  "confidence_score": 0.98,
  "category": null,
  "severity": null,
  "description": "Sorun yok.",
  "action_required": "Aksiyona gerek yok."
}
"""

        # 4. Yapay Zekaya (Gemini 2.5 Flash) İsteği Gönder
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, img]
        )
        
        # 5. Gelen Yanıtı Temizle ve JSON Formatına Çevir
        raw_text = response.text
        clean_text = raw_text.replace("```json", "").replace("```", "").strip()
        result_data = json.loads(clean_text)

        return result_data

    except Exception as e:
        # 6. Güvenlik Kalkanı: Sunucu çökmesini engelleyen orijinal güvenlik bloğu
        print(f"\n[ HATA YAKALANDI ] YAPAY ZEKA İŞLEM HATASI: {e}")
        
        return {
            "is_issue_detected": False,
            "confidence_score": 0.0,
            "category": None,
            "severity": None,
            "description": "Sistem Uyarı: Yapay zeka bu fotoğrafı işleyemedi veya bağlantı koptu.",
            "action_required": "Lütfen farklı bir görsel ile tekrar deneyin veya API kotanızı kontrol edin."
        }
    
    