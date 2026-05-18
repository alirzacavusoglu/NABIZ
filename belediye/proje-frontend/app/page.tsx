'use client';

import { useState, useEffect, useRef } from 'react';

interface Complaint {
  id: number;
  assignedMunicipality: string; 
  locationQuery: string; 
  displayAddress: string; 
  date: string;
  status: string;
  severity: string;
  category: string;
  description: string;
  actionRequired: string;
  previewUrl: string | null;
}

export default function Home() {
  const [currentRole, setCurrentRole] = useState<'user' | 'admin'>('user');
  const [inputMethod, setInputMethod] = useState<'map' | 'text'>('map');

  // Vatandaş Giriş Formu Stateleri
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Harita Konum Stateleri
  const [lat, setLat] = useState<string>("39.9043"); 
  const [lng, setLng] = useState<string>("41.2679");
  const [locStatus, setLocStatus] = useState<string>("Haritadan konumu seçin");

  // Elle Giriş Konum Stateleri
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [address, setAddress] = useState('');

  const [lastAssignedMunicipality, setLastAssignedMunicipality] = useState<string | null>(null);

  // 🌟 YENİ: Modern Bildirim (Toast) State'i
  const [toastMessage, setToastMessage] = useState<{text: string, type: 'error' | 'success'} | null>(null);

  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ortak Veri Havuzu
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [activeTab, setActiveTab] = useState<string>('HEPSİ');

  // Dinamik olarak yüklenen belediyeleri admin panelinde listelemek için benzersiz belediye listesi
  const [availableMunicipalities, setAvailableMunicipalities] = useState<string[]>([
    'Erzurum Büyükşehir Belediyesi',
    'Yakutiye Belediyesi',
    'Palandöken Belediyesi'
  ]);
  const [selectedMunicipalityFilter, setSelectedMunicipalityFilter] = useState<string>('Erzurum Büyükşehir Belediyesi');

  // 🌟 YENİ: Bildirim gösterme fonksiyonu (Eski alert() yerine kullanılacak)
  const showToast = (text: string, type: 'error' | 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000); // 4 saniye sonra otomatik kapanır
  };

  // LEAFLET HARİTA ALTYAPISINI YÜKLEME
  useEffect(() => {
    if (currentRole !== 'user' || inputMethod !== 'map') return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => initMap();
      document.body.appendChild(script);
    } else {
      setTimeout(initMap, 50);
    }

    function initMap() {
      const L = (window as any).L;
      if (!L || mapRef.current || !document.getElementById('leaflet-map-container')) return;
      const initialLat = parseFloat(lat);
      const initialLng = parseFloat(lng);
      
      mapRef.current = L.map('leaflet-map-container', { zoomControl: false }).setView([initialLat, initialLng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(mapRef.current);
      markerRef.current = L.marker([initialLat, initialLng], { draggable: true }).addTo(mapRef.current);

      markerRef.current.on('dragend', function () {
        const position = markerRef.current.getLatLng();
        updateCoords(position.lat, position.lng, "📍 Haritadan İşaretlendi");
      });

      mapRef.current.on('click', function (e: any) {
        markerRef.current.setLatLng(e.latlng);
        updateCoords(e.latlng.lat, e.latlng.lng, "📍 Haritadan İşaretlendi");
      });
    }

    return () => { 
      if (mapRef.current) { 
        mapRef.current.remove(); 
        mapRef.current = null; 
      } 
    };
  }, [currentRole, inputMethod]);

  const updateCoords = (newLat: number, newLng: number, statusText: string) => {
    setLat(newLat.toString());
    setLng(newLng.toString());
    setLocStatus(statusText);
  };

  const handleGetLiveLocation = () => {
    setLocStatus("📡 GPS Aranıyor...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;
          updateCoords(currentLat, currentLng, "✅ GPS Konumu Aktif");
          const L = (window as any).L;
          if (mapRef.current && markerRef.current && L) {
            mapRef.current.setView([currentLat, currentLng], 16);
            markerRef.current.setLatLng([currentLat, currentLng]);
          }
        },
        (error) => { setLocStatus("⚠️ GPS Alınamadı (Haritadan Seçin)"); }
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleUserSubmitReport = async () => {
    if (!file) return showToast('Lütfen önce bildireceğiniz sorunun fotoğrafını seçin!', 'error');
    if (inputMethod === 'text' && (!city.trim() || !district.trim() || !neighborhood.trim() || !address.trim())) {
      return showToast('Lütfen İl, İlçe, Mahalle ve Açık Adres alanlarının tamamını doldurun!', 'error');
    }

    setLoading(true);
    
    const formData = new FormData();
    formData.append('file', file);

    if (inputMethod === 'map') {
      formData.append('lat', lat);
      formData.append('lng', lng);
    } else {
      formData.append('city', city);
      formData.append('district', district);
      formData.append('neighborhood', neighborhood);
      formData.append('address', address);
    }

    try {
      let dynamicMunicipality = 'Erzurum Büyükşehir Belediyesi';
      let finalLocationQuery = '';
      let finalDisplayAddress = '';

      if (inputMethod === 'map') {
        finalLocationQuery = `${lat},${lng}`;
        finalDisplayAddress = `📍 COORD: [${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}]`;

        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=tr`);
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            const addr = geoData.address;
            const detectedDistrict = addr.borough || addr.town || addr.suburb || addr.district || addr.county;
            
            if (detectedDistrict) {
              const cleanName = detectedDistrict.replace('İlçesi', '').trim();
              dynamicMunicipality = `${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)} Belediyesi`;
            }
            if (geoData.display_name) {
              finalDisplayAddress = geoData.display_name;
            }
          }
        } catch (geoErr) {
          console.error("En yakın belediye tespit edilemedi, varsayılana dönülüyor:", geoErr);
        }
      } else {
        const cleanAddress = `${city.trim().toUpperCase()}, ${district.trim()}, ${neighborhood.trim()} Mh., ${address.trim()}`;
        finalLocationQuery = cleanAddress;
        finalDisplayAddress = cleanAddress;

        let cleanDistrict = district.trim().replace(/belediyesi/i, '').trim();
        cleanDistrict = cleanDistrict.charAt(0).toUpperCase() + cleanDistrict.slice(1);
        dynamicMunicipality = `${cleanDistrict} Belediyesi`;
      }

      const response = await fetch('http://127.0.0.1:8000/cukur-tespit/', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Sunucu hatası');
      const data = await response.json();

      const rawCategory = data.category ? data.category.toLowerCase() : 'genel';

      const newComplaint: Complaint = {
        id: Date.now(),
        assignedMunicipality: dynamicMunicipality, 
        locationQuery: finalLocationQuery,
        displayAddress: finalDisplayAddress,
        date: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        status: data.is_issue_detected ? 'Onay Bekliyor' : (data.description?.includes('Sahte') ? 'Asılsız İhbar' : 'Filtrelendi'),
        severity: data.is_issue_detected ? (data.severity || 'Orta') : 'Yok',
        category: rawCategory, 
        description: data.description || 'Açıklama Yok',
        actionRequired: data.action_required || 'Aksiyona gerek yok.',
        previewUrl: preview
      };

      setAvailableMunicipalities(prev => {
        if (!prev.includes(dynamicMunicipality)) {
          return [...prev, dynamicMunicipality];
        }
        return prev;
      });

      setComplaints(prev => [newComplaint, ...prev]);
      setLastAssignedMunicipality(dynamicMunicipality);

      setFile(null);
      setPreview(null);
      setCity('');
      setDistrict('');
      setNeighborhood('');
      setAddress('');
      
      showToast(`İhbarınız en yakın birim olan ${dynamicMunicipality}'ne başarıyla yönlendirildi!`, 'success');

    } catch (error) {
      console.error(error);
      showToast('Python backend sunucusuna bağlanılamadı. uvicorn açık mı?', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredComplaints = complaints.filter(c => {
    if (c.assignedMunicipality !== selectedMunicipalityFilter) return false;
    if (activeTab === 'HEPSİ') return true;

    const cat = (c.category || '').toLowerCase();

    if (activeTab === 'YOL / KALDIRIM') {
      return cat.includes('yol') || cat.includes('kaldirim') || cat.includes('kaldırım') || cat.includes('çukur') || cat.includes('cukur');
    }
    if (activeTab === 'AYDINLATMA / ENERJİ') {
      return cat.includes('aydinlatma') || cat.includes('aydınlatma') || cat.includes('enerji') || cat.includes('elektrik') || cat.includes('sokak');
    }
    if (activeTab === 'TEMİZLİK') {
      return cat.includes('temizlik') || cat.includes('çöp') || cat.includes('cop') || cat.includes('moloz') || cat.includes('atik') || cat.includes('atık');
    }
    if (activeTab === '🛡️ ASILSIZ İHBARLAR') {
      return cat.includes('asil') || cat.includes('asılsız') || c.status === 'Asılsız İhbar' || c.status === 'Filtrelendi';
    }
    
    return false;
  });

  return (
    <div className="h-screen w-full bg-slate-900 text-white font-sans antialiased flex flex-col overflow-hidden relative">
      
      {/* 🌟 YENİ: Modern Bildirim (Toast) Ekranı */}
      {toastMessage && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl shadow-2xl text-xs font-extrabold text-white flex items-center gap-3 border shadow-black/50 backdrop-blur-sm transition-all ${
          toastMessage.type === 'success' ? 'bg-emerald-600/90 border-emerald-400' : 'bg-rose-600/90 border-rose-400'
        }`}>
          <span className="text-lg">{toastMessage.type === 'success' ? '✅' : '⚠️'}</span>
          {toastMessage.text}
        </div>
      )}

      {/* Üst Konsol Barı */}
      <header className="w-full bg-slate-950 border-b border-gray-800 px-8 py-3.5 flex justify-between items-center shrink-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </div>
          <h1 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400 tracking-wider">NABIZ SİSTEMİ</h1>
        </div>

        {/* ROLLER ARASI MANUEL GEÇİŞ */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-gray-800 shadow-inner">
          <button onClick={() => setCurrentRole('user')}
            className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-wide transition-all ${currentRole === 'user' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            👤 VATANDAŞ GİRİŞİ
          </button>
          <button onClick={() => setCurrentRole('admin')}
            className={`px-4 py-1.5 rounded-lg text-xs font-black tracking-wide transition-all ${currentRole === 'admin' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            🏢 BELEDİYE PANELİ
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 border border-gray-800 px-3 py-1.5 rounded-md shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-black text-gray-300">SİSTEM: AKTİF</span>
        </div>
      </header>

      {/* 👤 GÖRÜNÜM 1: VATANDAŞ İHBAR GİRİŞ EKRANI */}
      {currentRole === 'user' && (
        <main className="flex-1 min-h-0 p-4 md:p-6 w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
          
          {/* SOL VE ORTA PANEL */}
          <div className="lg:col-span-8 flex flex-col h-full min-h-0 gap-4 overflow-hidden">
            
            {/* AKILLI SEÇİM BUTONLARI */}
            <div className="bg-gray-950 p-1.5 rounded-2xl border border-gray-800 flex gap-2 shrink-0">
              <button type="button" onClick={() => setInputMethod('map')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  inputMethod === 'map' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-md' : 'text-gray-400 border border-transparent hover:bg-gray-900'
                }`}
              >
                📍 Haritadan Konum Seç
              </button>
              <button type="button" onClick={() => setInputMethod('text')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  inputMethod === 'text' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-md' : 'text-gray-400 border border-transparent hover:bg-gray-900'
                }`}
              >
                ✍️ Adres Bilgisi Gir
              </button>
            </div>

            {/* HARİTA VEYA MANUEL FORM ALANI */}
            <div className="flex-1 min-h-0 bg-gray-950 rounded-3xl border border-gray-800 shadow-xl flex flex-col p-4 overflow-hidden">
              {inputMethod === 'map' ? (
                <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">🗺️ İnteraktif Harita Katmanı <span className="text-xs font-normal text-gray-500">({locStatus})</span></h2>
                    <div className="text-[11px] text-gray-600 font-mono bg-black/30 px-2.5 py-0.5 rounded-lg">LAT: {parseFloat(lat).toFixed(4)} | LNG: {parseFloat(lng).toFixed(4)}</div>
                  </div>
                  <div id="leaflet-map-container" className="flex-1 w-full rounded-2xl border border-gray-700 z-10 relative text-black min-h-0" />
                </div>
              ) : (
                <div className="flex flex-col justify-center h-full space-y-3 p-2 overflow-y-auto custom-scrollbar">
                  <h2 className="text-sm font-bold text-white border-b border-gray-800 pb-1 shrink-0">📋 Manuel Adres Formu</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1">İL *</label>
                      <input type="text" placeholder="Örn: Erzurum" value={city} onChange={(e) => setCity(e.target.value)} 
                        className="w-full bg-slate-900 border border-gray-800 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-500 font-semibold" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 mb-1">İLÇE (EN YAKIN BELEDİYE) *</label>
                      <input type="text" placeholder="Örn: Yakutiye" value={district} onChange={(e) => setDistrict(e.target.value)} 
                        className="w-full bg-slate-900 border border-gray-800 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-emerald-500 font-semibold" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1">MAHALLE *</label>
                    <input type="text" placeholder="Örn: Lalapaşa Mahallesi" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} 
                      className="w-full bg-slate-900 border border-gray-800 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500 font-semibold" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-1">AÇIK ADRES *</label>
                    <textarea rows={2} placeholder="Örn: Menderes Cad. No:14" value={address} onChange={(e) => setAddress(e.target.value)} 
                      className="w-full bg-slate-900 border border-gray-800 text-white text-xs rounded-lg px-3 py-2  outline-none focus:border-emerald-500 font-semibold resize-none" />
                  </div>
                </div>
              )}
            </div>

            {/* Dosya Yükleme Kutusu */}
            <div onClick={() => fileInputRef.current?.click()}
              className={`bg-gray-950 rounded-2xl p-4 border-2 border-dashed transition-all flex flex-col items-center justify-center h-[90px] shrink-0 cursor-pointer ${
                preview ? 'border-gray-800 bg-gray-800/30' : 'border-gray-700 hover:border-blue-500 hover:bg-gray-800'
              }`}
            >
              {preview ? (
                <div className="relative w-full flex items-center justify-center gap-4 h-full">
                  <img src={preview} alt="Seçilen yol" className="max-h-12 rounded object-contain" />
                  <p className="text-xs font-bold text-blue-400">Görseli Değiştirmek İçin Tıkla</p>
                </div>
              ) : (
                <div className="text-center flex flex-col items-center gap-1 text-gray-600">
                  <span className="text-2xl">📸</span>
                  <p className="font-medium text-[11px]">Sorun fotoğrafını buraya yükleyin veya sürükleyin *</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
            </div>

            {/* Gönderme Butonu */}
            <button onClick={handleUserSubmitReport} disabled={loading}
              className="w-full py-3.5 rounded-xl font-extrabold text-lg transition-all shadow-lg shrink-0 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-[0.99]"
            >
              {loading ? '⏳ Yapay Zeka En Yakın Yerel Yönetimi Saptıyor...' : '🚀 İhbarı En Yakın Belediyeye Yönlendir'}
            </button>
          </div>

          {/* SAĞ PANEL */}
          <div className="lg:col-span-4 bg-gray-950 rounded-3xl p-5 border border-gray-800 shadow-2xl flex flex-col h-full min-h-0 justify-between overflow-hidden">
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {lastAssignedMunicipality && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 shadow-xl animate-fade-in space-y-2">
                  <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">🛰️ YÖNLENDİRME BAŞARILI</span>
                  <div className="text-[11px] text-gray-300">İhbar uydudan tespit edilen en yakın yerel birime ulaştırıldı:</div>
                  <div className="text-xs font-black text-white bg-slate-900 border border-slate-800 p-2 rounded-xl text-center shadow-inner tracking-wide uppercase">
                    🏛️ {lastAssignedMunicipality}
                  </div>
                </div>
              )}

              {inputMethod === 'map' && (
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-sm font-bold text-white">📡 GPS Konum Doğrulama</h2>
                  <p className="text-[11px] text-gray-400 font-medium">Uydudan en net canlı konumunuzu çekmek için aşağıdaki butonu kullanın.</p>
                  <button onClick={handleGetLiveLocation} className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs font-bold transition-all border border-gray-700">
                    🎯 Canlı GPS Çek
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 text-[11px] text-gray-500 font-medium border-t border-gray-800 pt-3 shrink-0">
              <span className="text-[9px] font-black text-gray-600 uppercase tracking-wider block">Dinamik Coğrafi Otomasyon</span>
              <p>Sistem, seçilen koordinatın sınırları içerisinde kalan yetkili en yakın resmi ilçe belediyesini otomatik olarak belirler.</p>
            </div>
          </div>
        </main>
      )}

      {/* 🏢 GÖRÜNÜM 2: BELEDİYE KOMUTA PANELİ EKRANI */}
      {currentRole === 'admin' && (
        <main className="flex-1 min-h-0 w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-900 text-white overflow-hidden">
          
          {/* BELEDİYE SOL KISIM: KOMUTA LİSTESİ */}
          <section className="lg:col-span-4 bg-gray-950 rounded-xl shadow-md flex flex-col h-full overflow-hidden border border-gray-800">
            <div className="bg-indigo-600 h-1 w-full shrink-0"></div>
            
            <div className="p-2.5 bg-slate-950 text-white border-b border-gray-900 flex flex-col gap-1 shrink-0">
              <label className="text-[9px] font-black text-amber-400 uppercase tracking-widest">AKTİF KOMUTA MERKEZİ SEÇİMİ</label>
              <select value={selectedMunicipalityFilter} onChange={(e) => { setSelectedMunicipalityFilter(e.target.value); setSelectedComplaint(null); }}
                className="w-full bg-slate-900 border border-gray-800 text-xs text-white rounded px-2 py-1 outline-none font-bold cursor-pointer focus:border-amber-400"
              >
                {availableMunicipalities.map(muni => (
                  <option key={muni} value={muni}>🏛️ {muni}</option>
                ))}
              </select>
            </div>

            <div className="p-3 border-b border-gray-900 flex justify-between items-center bg-gray-950 shrink-0">
              <h2 className="text-xs font-black text-gray-300 uppercase tracking-wider">📋 Gelen İhbar Akışı</h2>
              <span className="bg-indigo-950 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-black border border-indigo-900">{filteredComplaints.length} İhbar</span>
            </div>

            {/* BÖLÜM SEÇİCİ SEKMELER */}
            <div className="flex gap-1 bg-slate-950 p-1 border-b border-gray-900 overflow-x-auto shrink-0 scrollbar-none">
              {['HEPSİ', 'YOL / KALDIRIM', 'AYDINLATMA / ENERJİ', 'TEMİZLİK', '🛡️ ASILSIZ İHBARLAR'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-2 py-0.5 rounded text-[9px] font-black tracking-wide uppercase transition-all whitespace-nowrap border shrink-0 ${
                    activeTab === tab ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-md' : 'text-gray-500 border-transparent hover:text-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            {/* İhbar Kartları Listesi */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar bg-gray-950/20">
              {filteredComplaints.length > 0 ? (
                filteredComplaints.map((complaint) => (
                  <div key={complaint.id} onClick={() => setSelectedComplaint(complaint)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm ${
                      selectedComplaint?.id === complaint.id ? 'border-indigo-600 bg-indigo-950/40 ring-1 ring-indigo-500 shadow-md' : 'bg-slate-900 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex flex-col gap-1.5">
                      <span className="font-extrabold text-gray-200 text-xs leading-snug line-clamp-1">{complaint.displayAddress}</span>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[9px] font-black text-indigo-400 uppercase bg-indigo-950 border border-indigo-900 px-1 py-0.5 rounded">{complaint.category.replace('_', ' ')}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${complaint.status === 'Asılsız İhbar' ? 'bg-rose-950/40 text-rose-400 border-rose-900' : 'bg-blue-950/40 text-blue-400 border-blue-900'}`}>{complaint.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-12 text-gray-500">
                  <span className="text-2xl mb-1">📡</span>
                  <p className="text-[10px] font-black uppercase tracking-wider text-center">İhbar kaydı yok.</p>
                </div>
              )}
            </div>
          </section>

          {/* BELEDİYE SAĞ KISIM: DETAY VE GERÇEK GOOGLE HARİTASI */}
          <section className="lg:col-span-8 flex flex-col lg:grid lg:grid-cols-2 gap-6 h-full min-h-0 overflow-hidden">
            
            {/* AI INCELEME MASASI */}
            <div className="bg-gray-950 rounded-xl shadow-md flex flex-col h-full overflow-hidden border border-gray-800">
              <div className="p-3 border-b border-gray-900 bg-gray-950 shrink-0">
                <h2 className="text-xs font-black text-gray-300 uppercase tracking-wider">🔎 Yapay Zeka Kriz Detayları</h2>
              </div>

              {selectedComplaint ? (
                <div className="p-3 flex flex-col flex-1 overflow-y-auto space-y-3 custom-scrollbar text-gray-300 min-h-0">
                  <div className="bg-slate-900 p-2 rounded-xl border border-gray-800 shadow-inner shrink-0">
                    <span className="text-[9px] font-black text-gray-500 block uppercase mb-1">SAHADAN GELEN GÖRSEL</span>
                    {/* 🌟 GÖRSEL ALANI BÜYÜTÜLDÜ: h-[95px] yerine h-[200px] yapıldı */}
                    <div className="w-full h-[200px] bg-black/40 border border-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
                      {selectedComplaint.previewUrl && <img src={selectedComplaint.previewUrl} alt="Saha Detay" className="max-h-full w-auto object-contain rounded" />}
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-900 border border-gray-800 rounded-xl shadow-sm text-xs">
                    <span className="text-[9px] font-black text-blue-400 block uppercase">YAPAY ZEKA ANALİZ ÇIKTISI</span>
                    <p className="font-bold mt-0.5 leading-relaxed text-gray-200">{selectedComplaint.description}</p>
                  </div>

                  <div className="p-2.5 bg-emerald-950/30 border border-emerald-900 rounded-xl shadow-sm text-xs">
                    <span className="text-[9px] font-black text-emerald-400 block uppercase">ÖNERİLEN AKSİYON</span>
                    <p className="font-black text-emerald-300 mt-0.5 leading-relaxed">{selectedComplaint.actionRequired}</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center p-6 opacity-50 text-gray-500">
                  <p className="text-xs font-bold uppercase tracking-wider">Detaylar için soldan bir ihbar seçin.</p>
                </div>
              )}
            </div>

            {/* GERÇEK INTERAKTİF GOOGLE HARİTASI */}
            <div className="bg-gray-950 rounded-xl shadow-md flex flex-col h-full overflow-hidden border border-gray-800 flex-1 min-h-0">
              <div className="p-3 border-b border-gray-900 bg-gray-950 shrink-0 flex justify-between items-center">
                <h2 className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-2">📍 Coğrafi Saha Haritası</h2>
              </div>

              <div className="flex-1 relative bg-slate-900 flex flex-col p-3 overflow-hidden min-h-0">
                {selectedComplaint ? (
                  <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden justify-between">
                    <div className="w-full flex-1 border border-gray-800 rounded-lg overflow-hidden bg-white shadow-sm min-h-0">
                      <iframe
                        title="Saha Konum Takibi"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedComplaint.locationQuery)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                      ></iframe>
                    </div>

                    <div className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg shadow-inner mt-2 text-gray-300 shrink-0">
                      <p className="text-[11px] font-bold text-gray-200 leading-tight line-clamp-2">{selectedComplaint.displayAddress}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-gray-800 rounded-lg bg-gray-950 text-gray-500">
                    <span className="text-3xl mb-1">🗺️</span>
                    <p className="text-[11px] font-black uppercase tracking-wider">Harita kilitlenmesi için ihbar seçin.</p>
                  </div>
                )}
              </div>
            </div>

          </section>
        </main>
      )}
    </div>
  );
}