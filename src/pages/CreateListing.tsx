import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';
import type { Listing } from '../types';
import type {
  Category, FuelType, TransmissionType, Condition,
  ElectronicType, ElectronicDetails, WarrantyStatus,
  PropertyType, PropertyDetails, HeatingType, TitleDeed,
  ListingAttachment,
} from '../types';
import { aiDescribe, aiEstimateValue, aiListingQuality, aiVisualDescription, aiErrorMessage, uploadFile, uploadImages } from '../services/api';
import { showToast } from '../components/Toast';
import { CITIES_81 } from '../data/cities';
import { VEHICLE_GROUPS, VEHICLE_GROUP_ICONS } from '../data/vehicleTypes';
import { VEHICLE_BRANDS, ELECTRONIC_BRANDS } from '../data/brands';
import BrandPicker from '../components/BrandPicker';

const fuels: FuelType[] = ['Benzin', 'Dizel', 'LPG', 'Hibrit', 'Elektrik'];
const transmissions: TransmissionType[] = ['Manuel', 'Otomatik', 'Yarı Otomatik'];
const conditions: Condition[] = ['Mükemmel', 'İyi', 'Orta', 'Yıpranmış'];

const electronicTypes: ElectronicType[] = ['Telefon', 'Laptop', 'Tablet', 'Televizyon', 'Kulaklık', 'Konsol', 'Kamera', 'Akıllı Saat', 'Diğer'];
const warranties:      WarrantyStatus[] = ['Devam ediyor', 'Bitti', 'Yok'];
const accessoryOptions = ['Orijinal kutu', 'Şarj cihazı', 'Kulaklık', 'Adaptör', 'Kılıf', 'Kablo', 'Fatura'];

const propertyTypes: PropertyType[] = ['Daire', 'Villa', 'Müstakil Ev', 'Arsa', 'Dükkan', 'Ofis', 'Yazlık'];
const heatings:      HeatingType[]  = ['Doğalgaz Kombi', 'Merkezi', 'Klima', 'Soba', 'Yerden Isıtma', 'Yok'];
const titleDeeds:    TitleDeed[]    = ['Kat Mülkiyetli', 'Kat İrtifaklı', 'Hisseli', 'Müstakil Tapu', 'Arsa Tapulu'];

interface FormData {
  title: string;
  category: Category;
  estimatedValue: string;
  description: string;
  wantedFor: string;
  city: string;
  condition: Condition;

  // Araç
  brand: string;
  model: string;
  year: string;
  km: string;
  fuel: FuelType;
  transmission: TransmissionType;
  color: string;
  hasAccidentRecord: boolean;
  bodyType: string;
  hasExpertise: boolean;
  expertiseFirm: string;
  expertiseDate: string;
  expertiseNote: string;

  // Elektronik
  elecType:     ElectronicType;
  elecBrand:    string;
  elecModel:    string;
  elecYear:     string;
  storage:      string;
  ram:          string;
  screenSize:   string;
  elecColor:    string;
  os:           string;
  batteryHealth:string;
  warranty:     WarrantyStatus;
  accessories:  string[];

  // Gayrimenkul
  propType:     PropertyType;
  netSqm:       string;
  grossSqm:     string;
  rooms:        string;
  buildingAge:  string;
  floor:        string;
  heating:      HeatingType;
  furnished:    boolean;
  balcony:      boolean;
  elevator:     boolean;
  parking:      boolean;
  titleDeed:    TitleDeed;
  monthlyDues:  string;

  previewImages: string[];
  attachments: ListingAttachment[];
}

export default function CreateListing() {
  useSEO({ title: 'İlan Ver', description: 'Aracını Takaslat\'ta ücretsiz ilan ver, binlerce kullanıcıya ulaş.' });

  const navigate = useNavigate();
  const { addListing, currentUser } = useAppStore();
  const [vehicleGroup, setVehicleGroup] = useState('');
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [aiLoading,  setAiLoading]  = useState(false);
  const [valueHint,  setValueHint]  = useState<{ low: number; high: number; estimated: number; basedOn: number } | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [visualNote, setVisualNote] = useState<string | null>(null);
  const [qualityHint, setQualityHint] = useState<{
    score: number;
    grade: string;
    fixes: string[];
    improvedDescription: string;
  } | null>(null);

  useEffect(() => {
    // Sayfa ilk açıldığında: taslak var mı kontrol et
    try {
      const raw = localStorage.getItem('takaslat-draft');
      if (raw) {
        const draft = JSON.parse(raw);
        // Login'den döndüyse (resume flag) ve giriş yapılmışsa: otomatik geri yükle
        const resuming = localStorage.getItem('takaslat-resume-after-login');
        if (resuming && currentUser) {
          localStorage.removeItem('takaslat-resume-after-login');
          setForm(draft);
          if (draft.bodyType) {
            const grp = Object.entries(VEHICLE_GROUPS).find(([, types]) => types.includes(draft.bodyType))?.[0];
            if (grp) setVehicleGroup(grp);
          }
          setStep(3);
          showToast('Bilgilerin geri yüklendi — şimdi yayınlayabilirsin', 'success');
          return;
        }
        // En az bir anlamlı içerik varsa göster
        if (draft.title || draft.description || draft.brand || draft.elecBrand || draft.netSqm) {
          setHasDraft(true);
        }
      }
    } catch { /* */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function restoreDraft() {
    try {
      const raw = localStorage.getItem('takaslat-draft');
      if (raw) {
        const draft = JSON.parse(raw);
        setForm(draft);
        if (draft.bodyType) {
          const grp = Object.entries(VEHICLE_GROUPS).find(([, types]) => types.includes(draft.bodyType))?.[0];
          if (grp) setVehicleGroup(grp);
        }
      }
      setHasDraft(false);
      showToast('Taslak geri yüklendi', 'success');
    } catch { /* */ }
  }
  function dismissDraft() {
    localStorage.removeItem('takaslat-draft');
    setHasDraft(false);
  }

  // ── İlan çoğaltma: localStorage'tan kopyalanmış ilanı oku
  useEffect(() => {
    const dup = localStorage.getItem('takaslat-duplicate');
    if (!dup) return;
    try {
      const src = JSON.parse(dup) as Listing;
      setForm((f) => ({
        ...f,
        category:       src.category,
        condition:      src.condition,
        city:           src.city,
        estimatedValue: src.estimatedValue.toString(),
        description:    src.description,
        wantedFor:      src.wantedFor,
        title:          src.title + ' (Kopya)',
        // Vehicle
        brand:        src.vehicleDetails?.brand        ?? f.brand,
        model:        src.vehicleDetails?.model        ?? f.model,
        year:         src.vehicleDetails?.year ? src.vehicleDetails.year.toString() : f.year,
        km:           src.vehicleDetails?.km ? src.vehicleDetails.km.toString() : f.km,
        fuel:         src.vehicleDetails?.fuel         ?? f.fuel,
        transmission: src.vehicleDetails?.transmission ?? f.transmission,
        color:        src.vehicleDetails?.color        ?? f.color,
        bodyType:     src.vehicleDetails?.bodyType     ?? f.bodyType,
        hasAccidentRecord: src.vehicleDetails?.hasAccidentRecord ?? f.hasAccidentRecord,
        hasExpertise:  src.vehicleDetails?.hasExpertise  ?? f.hasExpertise,
        expertiseFirm: src.vehicleDetails?.expertiseFirm ?? f.expertiseFirm,
        expertiseDate: src.vehicleDetails?.expertiseDate ?? f.expertiseDate,
        expertiseNote: src.vehicleDetails?.expertiseNote ?? f.expertiseNote,
        // Electronic
        elecType:  (src.electronicDetails?.type as typeof f.elecType) ?? f.elecType,
        elecBrand: src.electronicDetails?.brand   ?? f.elecBrand,
        elecModel: src.electronicDetails?.model   ?? f.elecModel,
        storage:   src.electronicDetails?.storage ?? f.storage,
        ram:       src.electronicDetails?.ram     ?? f.ram,
        warranty:  (src.electronicDetails?.warranty as typeof f.warranty) ?? f.warranty,
        // Property
        propType:  (src.propertyDetails?.type as typeof f.propType) ?? f.propType,
        netSqm:    src.propertyDetails?.netSqm ? src.propertyDetails.netSqm.toString() : f.netSqm,
        rooms:     src.propertyDetails?.rooms ?? f.rooms,
      }));
      if (src.vehicleDetails?.bodyType) {
        const grp = Object.entries(VEHICLE_GROUPS).find(([, types]) => types.includes(src.vehicleDetails!.bodyType!))?.[0];
        if (grp) setVehicleGroup(grp);
      }
      localStorage.removeItem('takaslat-duplicate');
      showToast('Önceki ilan kopyalandı, alanları gözden geçir', 'info');
    } catch { /* malformed */ }
  }, []);


  async function handleAiDescribe() {
    if (!form.brand || !form.model || !form.year) {
      showToast('Marka, model ve yıl gerekli', 'error');
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiDescribe({
        brand:             form.brand,
        model:             form.model,
        year:              Number(form.year),
        km:                form.km ? Number(form.km) : undefined,
        fuel:              form.fuel,
        transmission:      form.transmission,
        color:             form.color || undefined,
        bodyType:          form.bodyType,
        hasAccidentRecord: form.hasAccidentRecord,
        condition:         form.condition,
        city:              form.city,
      });
      setForm((f) => ({ ...f, description: res.description }));
      showToast(res.basedOnSimilar > 0
        ? `${res.basedOnSimilar} benzer ilana göre yazıldı`
        : 'Açıklama oluşturuldu', 'success');
    } catch (err) {
      showToast(aiErrorMessage(err), 'error');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleEstimateValue() {
    if (!form.brand || !form.model) {
      showToast('Marka ve model gerekli', 'error');
      return;
    }
    setAiLoading(true);
    try {
      const res = await aiEstimateValue({
        brand:             form.brand,
        model:             form.model,
        year:              form.year ? Number(form.year) : undefined,
        km:                form.km ? Number(form.km) : undefined,
        hasAccidentRecord: form.hasAccidentRecord,
      });
      if (res.estimated && res.low && res.high) {
        setValueHint({ estimated: res.estimated, low: res.low, high: res.high, basedOn: res.basedOn });
        setForm((f) => ({ ...f, estimatedValue: res.estimated!.toString() }));
        showToast(`${res.basedOn} benzer ilanın ortalaması alındı`, 'success');
      } else {
        showToast(res.message, 'info');
      }
    } catch (err) {
      showToast(aiErrorMessage(err), 'error');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleQualityCheck() {
    const draftTitle =
      form.title ||
      (form.category === 'Araç'
        ? `${form.year} ${form.brand} ${form.model}`.trim()
        : form.category === 'Elektronik'
        ? `${form.elecBrand} ${form.elecModel}${form.storage ? ` ${form.storage}` : ''}`.trim()
        : form.category === 'Gayrimenkul'
        ? `${form.netSqm ? `${form.netSqm}m² ` : ''}${form.rooms} ${form.propType}`.trim()
        : 'Takas İlanı');

    if (!form.description || !form.estimatedValue) {
      showToast('Kalite kontrol için açıklama ve değer gerekli', 'error');
      return;
    }

    setAiLoading(true);
    try {
      const res = await aiListingQuality({
        draft: {
          title: draftTitle,
          category: form.category,
          estimatedValue: Number(form.estimatedValue),
          description: form.description,
          wantedFor: form.wantedFor,
          city: form.city,
          condition: form.condition,
          images: form.previewImages,
          attachments: form.attachments,
          vehicleDetails: form.category === 'Araç' ? {
            brand: form.brand,
            model: form.model,
            year: form.year ? Number(form.year) : undefined,
            km: form.km ? Number(form.km) : undefined,
            fuel: form.fuel,
            transmission: form.transmission,
            color: form.color,
            hasAccidentRecord: form.hasAccidentRecord,
            bodyType: form.bodyType,
          } : undefined,
          electronicDetails: form.category === 'Elektronik' ? {
            type: form.elecType,
            brand: form.elecBrand,
            model: form.elecModel,
            year: form.elecYear ? Number(form.elecYear) : undefined,
            storage: form.storage,
            ram: form.ram,
            warranty: form.warranty,
          } : undefined,
          propertyDetails: form.category === 'Gayrimenkul' ? {
            type: form.propType,
            netSqm: form.netSqm ? Number(form.netSqm) : undefined,
            rooms: form.rooms,
            buildingAge: form.buildingAge ? Number(form.buildingAge) : undefined,
            heating: form.heating,
            titleDeed: form.titleDeed,
          } : undefined,
        },
      });
      setQualityHint(res);
      showToast(`AI kalite puanı: ${res.score}/100`, res.score >= 70 ? 'success' : 'info');
    } catch (err) {
      showToast(aiErrorMessage(err), 'error');
    } finally {
      setAiLoading(false);
    }
  }

  const [form, setForm] = useState<FormData>({
    title: '',
    category: 'Araç',
    estimatedValue: '',
    description: '',
    wantedFor: '',
    city: 'İstanbul',
    condition: 'İyi',
    // Araç
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    km: '',
    fuel: 'Benzin',
    transmission: 'Otomatik',
    color: '',
    hasAccidentRecord: false,
    bodyType: 'Sedan',
    hasExpertise: false,
    expertiseFirm: '',
    expertiseDate: '',
    expertiseNote: '',
    // Elektronik
    elecType:      'Telefon',
    elecBrand:     '',
    elecModel:     '',
    elecYear:      new Date().getFullYear().toString(),
    storage:       '',
    ram:           '',
    screenSize:    '',
    elecColor:     '',
    os:            '',
    batteryHealth: '',
    warranty:      'Yok',
    accessories:   [],
    // Gayrimenkul
    propType:      'Daire',
    netSqm:        '',
    grossSqm:      '',
    rooms:         '2+1',
    buildingAge:   '',
    floor:         '',
    heating:       'Doğalgaz Kombi',
    furnished:     false,
    balcony:       true,
    elevator:      false,
    parking:       false,
    titleDeed:     'Kat Mülkiyetli',
    monthlyDues:   '',

    previewImages: [],
    attachments: [],
  });

  const update = (key: keyof FormData, value: FormData[typeof key]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // ── 💾 Otomatik taslak: her form değişikliğinde localStorage'a yaz (debounce)
  useEffect(() => {
    if (submitted) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem('takaslat-draft', JSON.stringify(form));
      } catch { /* quota / private mode */ }
    }, 500);
    return () => clearTimeout(t);
  }, [form, submitted]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 5);
    if (!files.length) return;
    setUploading(true);
    try {
      // Önce anlık önizleme için blob URL'leri göster
      const previews = files.map((f) => URL.createObjectURL(f));
      update('previewImages', [...form.previewImages, ...previews].slice(0, 5));

      // Supabase Storage'a yükle — kalıcı URL'lerle değiştir
      const permanentUrls = await uploadImages(files);
      update('previewImages', [
        ...form.previewImages.filter((u) => !u.startsWith('blob:')),
        ...permanentUrls,
      ].slice(0, 5));

      // Ek olarak attachment listesine de ekle
      const attachments = files.map((f, i): ListingAttachment => ({
        id:        `img-${Date.now()}-${i}`,
        name:      f.name,
        url:       permanentUrls[i] ?? URL.createObjectURL(f),
        mimeType:  f.type,
        kind:      'image',
        size:      f.size,
        createdAt: new Date().toISOString(),
      }));
      update('attachments', [...form.attachments, ...attachments]);

      // AI görsel analizi (ilk fotoğraf)
      if (files[0]) {
        const note = await aiVisualDescription({ fileName: files[0].name, mimeType: files[0].type, size: files[0].size });
        setVisualNote(note.summary);
      }
      showToast('Fotoğraflar yüklendi', 'success');
    } catch {
      showToast('Yükleme başarısız — internet bağlantını kontrol et', 'error');
      update('previewImages', form.previewImages.filter((u) => !u.startsWith('blob:')));
    } finally {
      setUploading(false);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((file) => uploadFile(file, file.type === 'application/pdf' ? 'expertise' : 'document')));
      update('attachments', [...form.attachments, ...uploaded]);
      const first = uploaded[0];
      if (first) {
        const note = await aiVisualDescription({ fileName: first.name, mimeType: first.mimeType, size: first.size });
        setVisualNote(note.summary);
      }
      showToast('Belge yüklendi', 'success');
    } catch {
      showToast('Belge yüklenemedi', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Giriş yoksa: taslağı kaydet, login'e gönder, dönüşte kaldığı yerden devam etsin
    if (!currentUser) {
      try {
        localStorage.setItem('takaslat-draft', JSON.stringify(form));
        localStorage.setItem('takaslat-resume-after-login', '1');
      } catch { /* */ }
      showToast('Son adım! İlanını yayınlamak için giriş yap — bilgilerin kayıtlı', 'info');
      navigate('/login?redirect=/create');
      return;
    }

    // Otomatik başlık
    let autoTitle = form.title;
    if (!autoTitle) {
      if (form.category === 'Araç')        autoTitle = `${form.year} ${form.brand} ${form.model}`;
      else if (form.category === 'Elektronik') autoTitle = `${form.elecBrand} ${form.elecModel}${form.storage ? ` ${form.storage}` : ''}`;
      else if (form.category === 'Gayrimenkul') autoTitle = `${form.netSqm ? form.netSqm + 'm² ' : ''}${form.rooms ? form.rooms + ' ' : ''}${form.propType}`;
      else                                 autoTitle = 'Takas İlanı';
    }

    // Tag'leri kategori bazlı oluştur
    const tags: string[] = [form.condition];
    if (form.category === 'Araç')        tags.push(form.fuel, form.transmission);
    if (form.category === 'Elektronik')  tags.push(form.elecType, form.warranty);
    if (form.category === 'Gayrimenkul') tags.push(form.propType, form.rooms);

    const electronicDetails: ElectronicDetails | undefined = form.category === 'Elektronik' ? {
      type:          form.elecType,
      brand:         form.elecBrand,
      model:         form.elecModel,
      year:          form.elecYear  ? Number(form.elecYear) : undefined,
      storage:       form.storage   || undefined,
      ram:           form.ram       || undefined,
      screenSize:    form.screenSize? Number(form.screenSize) : undefined,
      color:         form.elecColor || undefined,
      os:            form.os        || undefined,
      batteryHealth: form.batteryHealth ? Number(form.batteryHealth) : undefined,
      warranty:      form.warranty,
      accessories:   form.accessories.length > 0 ? form.accessories : undefined,
    } : undefined;

    const propertyDetails: PropertyDetails | undefined = form.category === 'Gayrimenkul' ? {
      type:         form.propType,
      netSqm:       form.netSqm      ? Number(form.netSqm)      : undefined,
      grossSqm:     form.grossSqm    ? Number(form.grossSqm)    : undefined,
      rooms:        form.rooms       || undefined,
      buildingAge:  form.buildingAge ? Number(form.buildingAge) : undefined,
      floor:        form.floor       || undefined,
      heating:      form.heating,
      furnished:    form.furnished,
      balcony:      form.balcony,
      elevator:     form.elevator,
      parking:      form.parking,
      titleDeed:    form.titleDeed,
      monthlyDues:  form.monthlyDues ? Number(form.monthlyDues) : undefined,
    } : undefined;

    try {
      await addListing({
      title:          autoTitle,
      category:       form.category,
      estimatedValue: Number(form.estimatedValue),
      description:    form.description,
      wantedFor:      form.wantedFor,
      city:           form.city,
      condition:      form.condition,
      images: form.previewImages.length > 0
        ? form.previewImages
        : [`https://picsum.photos/seed/${Date.now()}/800/600`],
      tags: tags.filter(Boolean),
      vehicleDetails: form.category === 'Araç' ? {
        brand:             form.brand,
        model:             form.model,
        year:              Number(form.year),
        km:                Number(form.km),
        fuel:              form.fuel,
        transmission:      form.transmission,
        color:             form.color,
        hasAccidentRecord: form.hasAccidentRecord,
        bodyType:          form.bodyType,
        hasExpertise:      form.hasExpertise || undefined,
        expertiseFirm:     form.expertiseFirm || undefined,
        expertiseDate:     form.expertiseDate || undefined,
        expertiseNote:     form.expertiseNote || undefined,
      } : undefined,
      electronicDetails,
      propertyDetails,
      attachments: form.attachments,
      });
      localStorage.removeItem('takaslat-draft');
      setSubmitted(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'İlan kaydedilemedi', 'error');
    }
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">İlanınız Yayınlandı!</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">İlanınız aktif oldu. Teklifler "Tekliflerim" sayfasında görünecek.</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            İlanları Gör
          </button>
          <button
            onClick={() => { setSubmitted(false); setStep(1); setForm({ ...form, title: '', description: '', wantedFor: '' }); }}
            className="border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Yeni İlan Ver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Takas İlanı Ver</h1>
        <p className="text-slate-500 dark:text-slate-400">Takas etmek istediğiniz ürünü listeyin</p>
      </div>

      {hasDraft && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💾</span>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Bekleyen taslağın var</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">Önceki sayfa açılışından kayıtlı bir taslak bulundu</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={dismissDraft}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
            >
              Sil
            </button>
            <button
              onClick={restoreDraft}
              className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg"
            >
              📥 Geri Yükle
            </button>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}
            >
              {step > s ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : s}
            </div>
            {s < 3 && <div className={`h-0.5 w-12 ${step > s ? 'bg-blue-600' : 'bg-slate-200'}`} />}
          </div>
        ))}
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
          {step === 1 ? 'Kategori & Araç' : step === 2 ? 'Fiyat & Açıklama' : 'Fotoğraf & Takas Tercihi'}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
                <span className="text-2xl">🚗</span>
                <div>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Taşıt İlanı</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400">Araç, motosiklet, kamyon, karavan, bisiklet ve tekerleği olan her şey.</p>
                </div>
              </div>
            </div>

            {form.category === 'Araç' && (
              <>
                {/* 1. Araç Grubu */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Araç Grubu *</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {Object.entries(VEHICLE_GROUPS).map(([group, types]) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => { setVehicleGroup(group); update('bodyType', types[0]); }}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${
                          vehicleGroup === group
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                      >
                        <span className="text-2xl">{VEHICLE_GROUP_ICONS[group]}</span>
                        <span className="text-xs font-semibold">{group}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {vehicleGroup && (
                  <>
                    {/* 2. Kasa / Tür - gruba göre filtrelenmiş */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Kasa / Tür *</label>
                      <div className="flex flex-wrap gap-1.5">
                        {VEHICLE_GROUPS[vehicleGroup].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => update('bodyType', t)}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                              form.bodyType === t
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Marka + Model */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Marka *</label>
                        <BrandPicker
                          required
                          value={form.brand}
                          onChange={(b) => update('brand', b)}
                          brands={VEHICLE_BRANDS}
                          placeholder="Toyota, BMW..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Model *</label>
                        <input
                          required
                          type="text"
                          placeholder="Corolla, 320i..."
                          value={form.model}
                          onChange={(e) => update('model', e.target.value)}
                          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* 4. Yıl + KM + Renk */}
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Yıl *</label>
                        <input
                          required
                          type="number"
                          min="1990"
                          max={new Date().getFullYear()}
                          value={form.year}
                          onChange={(e) => update('year', e.target.value)}
                          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Kilometre *</label>
                        <input
                          required
                          type="number"
                          placeholder="75000"
                          value={form.km}
                          onChange={(e) => update('km', e.target.value)}
                          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Renk</label>
                        <input
                          type="text"
                          placeholder="Beyaz, Siyah..."
                          value={form.color}
                          onChange={(e) => update('color', e.target.value)}
                          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* 5. Yakıt + Şanzıman */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Yakıt Tipi</label>
                        <select
                          value={form.fuel}
                          onChange={(e) => update('fuel', e.target.value as FuelType)}
                          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {fuels.map((f) => <option key={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Şanzıman</label>
                        <select
                          value={form.transmission}
                          onChange={(e) => update('transmission', e.target.value as TransmissionType)}
                          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {transmissions.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* 6. Hasar kaydı */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                      <input
                        type="checkbox"
                        id="accidentRecord"
                        checked={form.hasAccidentRecord}
                        onChange={(e) => update('hasAccidentRecord', e.target.checked)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <label htmlFor="accidentRecord" className="text-sm text-slate-700 dark:text-slate-200">
                        Hasar kaydı var
                      </label>
                    </div>

                    {/* 7. Ekspertiz */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 space-y-3">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          id="hasExpertise"
                          checked={form.hasExpertise}
                          onChange={(e) => update('hasExpertise', e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-blue-600 flex-shrink-0"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Ekspertiz yaptırıldı</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Araç bağımsız ekspertiz firmasından geçmiş</p>
                        </div>
                      </label>
                      {form.hasExpertise && (
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Firma / Servis</label>
                            <input
                              type="text"
                              placeholder="Ekspertizim, Otocheck..."
                              value={form.expertiseFirm}
                              onChange={(e) => update('expertiseFirm', e.target.value)}
                              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Tarih</label>
                            <input
                              type="date"
                              value={form.expertiseDate}
                              onChange={(e) => update('expertiseDate', e.target.value)}
                              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Sonuç / Not</label>
                            <input
                              type="text"
                              placeholder="Hasar yok, ön kaput boyalı vb."
                              value={form.expertiseNote}
                              onChange={(e) => update('expertiseNote', e.target.value)}
                              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ═════════════════ ELEKTRONİK ═════════════════ */}
            {form.category === 'Elektronik' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Cihaz Türü</label>
                  <div className="flex flex-wrap gap-1.5">
                    {electronicTypes.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => update('elecType', t)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                          form.elecType === t
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Marka *</label>
                    <BrandPicker
                      required
                      value={form.elecBrand}
                      onChange={(b) => update('elecBrand', b)}
                      brands={ELECTRONIC_BRANDS}
                      placeholder="Apple, Samsung..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Model *</label>
                    <input required type="text" placeholder="iPhone 14 Pro, MacBook Air..."
                      value={form.elecModel}
                      onChange={(e) => update('elecModel', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Yıl</label>
                    <input type="number" min="2000" max={new Date().getFullYear()}
                      value={form.elecYear}
                      onChange={(e) => update('elecYear', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Depolama</label>
                    <input type="text" placeholder="256 GB"
                      value={form.storage}
                      onChange={(e) => update('storage', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">RAM</label>
                    <input type="text" placeholder="8 GB"
                      value={form.ram}
                      onChange={(e) => update('ram', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Ekran (inç)</label>
                    <input type="number" step="0.1" placeholder="6.1"
                      value={form.screenSize}
                      onChange={(e) => update('screenSize', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Renk</label>
                    <input type="text" placeholder="Siyah"
                      value={form.elecColor}
                      onChange={(e) => update('elecColor', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">İşletim Sis.</label>
                    <input type="text" placeholder="iOS 17"
                      value={form.os}
                      onChange={(e) => update('os', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Garanti</label>
                    <select value={form.warranty}
                      onChange={(e) => update('warranty', e.target.value as WarrantyStatus)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {warranties.map((w) => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Batarya Sağlığı (%)</label>
                    <input type="number" min="0" max="100" placeholder="92"
                      value={form.batteryHealth}
                      onChange={(e) => update('batteryHealth', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Aksesuarlar (varsa)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {accessoryOptions.map((a) => {
                      const active = form.accessories.includes(a);
                      return (
                        <button key={a} type="button"
                          onClick={() => update('accessories', active
                            ? form.accessories.filter((x) => x !== a)
                            : [...form.accessories, a])}
                          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                            active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                          }`}>
                          {active ? '✓ ' : ''}{a}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ═════════════════ GAYRİMENKUL ═════════════════ */}
            {form.category === 'Gayrimenkul' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Mülk Türü</label>
                  <div className="flex flex-wrap gap-1.5">
                    {propertyTypes.map((t) => (
                      <button key={t} type="button"
                        onClick={() => update('propType', t)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                          form.propType === t
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Net m² *</label>
                    <input required type="number" placeholder="120"
                      value={form.netSqm}
                      onChange={(e) => update('netSqm', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Brüt m²</label>
                    <input type="number" placeholder="140"
                      value={form.grossSqm}
                      onChange={(e) => update('grossSqm', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Oda</label>
                    <select value={form.rooms}
                      onChange={(e) => update('rooms', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {['Stüdyo', '1+0', '1+1', '2+1', '3+1', '4+1', '5+1', '6+ Oda'].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Bina Yaşı</label>
                    <input type="number" min="0" placeholder="5"
                      value={form.buildingAge}
                      onChange={(e) => update('buildingAge', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Kat</label>
                    <input type="text" placeholder="3/8"
                      value={form.floor}
                      onChange={(e) => update('floor', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Aidat (₺/ay)</label>
                    <input type="number" placeholder="500"
                      value={form.monthlyDues}
                      onChange={(e) => update('monthlyDues', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Isıtma</label>
                    <select value={form.heating}
                      onChange={(e) => update('heating', e.target.value as HeatingType)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {heatings.map((h) => <option key={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Tapu Durumu</label>
                    <select value={form.titleDeed}
                      onChange={(e) => update('titleDeed', e.target.value as TitleDeed)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {titleDeeds.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'furnished' as const, label: '🛋️ Eşyalı' },
                    { key: 'balcony'   as const, label: '🌿 Balkon' },
                    { key: 'elevator'  as const, label: '🛗 Asansör' },
                    { key: 'parking'   as const, label: '🅿️ Otopark' },
                  ].map(({ key, label }) => (
                    <label key={key}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all text-sm ${
                        form[key]
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                      }`}>
                      <input type="checkbox" className="sr-only"
                        checked={form[key]}
                        onChange={(e) => update(key, e.target.checked)} />
                      <span className="font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Durum</label>
                <select
                  value={form.condition}
                  onChange={(e) => update('condition', e.target.value as Condition)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {conditions.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Şehir</label>
                <select
                  value={form.city}
                  onChange={(e) => update('city', e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CITIES_81.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={
                (form.category === 'Araç'        && (!vehicleGroup || !form.brand || !form.model || !form.km)) ||
                (form.category === 'Elektronik'  && (!form.elecBrand || !form.elecModel))                      ||
                (form.category === 'Gayrimenkul' && !form.netSqm)
              }
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Devam Et
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">İlan Başlığı</label>
              <input
                type="text"
                placeholder={
                  form.category === 'Araç'         ? `${form.year} ${form.brand} ${form.model}` :
                  form.category === 'Elektronik'   ? `${form.elecBrand} ${form.elecModel}${form.storage ? ' ' + form.storage : ''}` :
                  form.category === 'Gayrimenkul'  ? `${form.netSqm || ''}m² ${form.rooms} ${form.propType}` :
                  'İlan başlığı...'
                }
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Boş bırakırsanız otomatik oluşturulur</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Tahmini Değer (₺) *
                </label>
                {form.category === 'Araç' && (
                  <button
                    type="button"
                    onClick={handleEstimateValue}
                    disabled={aiLoading || !form.brand || !form.model}
                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-200 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                  >
                    <span>💰</span>
                    {aiLoading ? 'Hesaplanıyor…' : 'AI ile hesapla'}
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₺</span>
                <input
                  required
                  type="number"
                  placeholder="850000"
                  value={form.estimatedValue}
                  onChange={(e) => update('estimatedValue', e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-lg pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {form.estimatedValue && (
                <p className="text-xs text-emerald-600 mt-1">
                  ≈ {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(form.estimatedValue))}
                </p>
              )}
              {valueHint && (
                <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                  <p className="font-semibold text-emerald-800 mb-0.5">💰 AI Değer Aralığı ({valueHint.basedOn} ilan)</p>
                  <p className="text-emerald-700">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(valueHint.low)}
                    {' – '}
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(valueHint.high)}
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Açıklama *</label>
                {form.category === 'Araç' && (
                  <button
                    type="button"
                    onClick={handleAiDescribe}
                    disabled={aiLoading || !form.brand || !form.model}
                    className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-200 px-3 py-1 rounded-full transition-colors flex items-center gap-1"
                  >
                    <span>✦</span>
                    {aiLoading ? 'Yazılıyor…' : 'AI ile yaz'}
                  </button>
                )}
              </div>
              <textarea
                required
                rows={5}
                placeholder="Aracınız veya ürününüz hakkında detaylı bilgi verin. Bakım geçmişi, ekstra özellikler, neden takas etmek istediğiniz..."
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                ✦ AI: marka/model bilgisinden başlayıp benzer ilanlara bakarak otomatik metin üretir.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-900/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">AI yayın öncesi kontrol</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    Açıklama, fiyat, görsel ve teknik alanlara göre ilanın güven skorunu çıkarır.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleQualityCheck}
                  disabled={aiLoading || !form.estimatedValue || !form.description}
                  className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiLoading ? 'Kontrol...' : 'Kontrol et'}
                </button>
              </div>

              {qualityHint && (
                <div className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr]">
                  <div className={`rounded-xl border p-3 text-center ${
                    qualityHint.score >= 80
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : qualityHint.score >= 55
                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    <div className="text-2xl font-black">{qualityHint.score}</div>
                    <div className="text-xs font-bold">/100 · {qualityHint.grade}</div>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-slate-900 p-3 border border-slate-100 dark:border-slate-700">
                    <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">Önerilen düzeltmeler</p>
                    <ul className="space-y-1">
                      {qualityHint.fixes.slice(0, 4).map((fix) => (
                        <li key={fix} className="text-xs text-slate-700 dark:text-slate-300">✓ {fix}</li>
                      ))}
                    </ul>
                    {qualityHint.improvedDescription && qualityHint.improvedDescription !== form.description && (
                      <button
                        type="button"
                        onClick={() => update('description', qualityHint.improvedDescription)}
                        className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
                      >
                        AI açıklamasını uygula
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium py-3 rounded-xl transition-colors"
              >
                Geri
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!form.estimatedValue || !form.description}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Devam Et
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Ne istiyorsunuz? *
              </label>
              <textarea
                required
                rows={3}
                placeholder="Hangi araç veya ürünle takas yapmak istiyorsunuz? Fiyat farkı öder misiniz? Örn: 'SUV veya crossover, max 100k TL fark öderim.'"
                value={form.wantedFor}
                onChange={(e) => update('wantedFor', e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Fotoğraflar (Maks. 5)
              </label>
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded-xl p-6 text-center transition-colors">
                  <svg className="w-8 h-8 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Fotoğraf yüklemek için tıklayın</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PNG, JPG (Mock: Picsum görseli kullanılır)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              {uploading && (
                <p className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300">Dosyalar yükleniyor...</p>
              )}
              {form.previewImages.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {form.previewImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="" className="w-16 h-16 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={() => update('previewImages', form.previewImages.filter((_, idx) => idx !== i))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Ekspertiz / Belge Eki
              </label>
              <label className="block cursor-pointer">
                <div className="border border-slate-200 dark:border-slate-700 hover:border-amber-400 rounded-xl p-4 bg-slate-50 dark:bg-slate-900/60 transition-colors">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">PDF veya belge görseli ekle</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ekspertiz raporu, fatura ve servis kaydı gibi dosyalar ilana güven katar.</p>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  multiple
                  onChange={handleAttachmentUpload}
                  className="hidden"
                />
              </label>
              {form.attachments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {form.attachments.map((file) => (
                    <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{Math.round(file.size / 1024)} KB</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => update('attachments', form.attachments.filter((a) => a.id !== file.id))}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Kaldır
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {visualNote && (
                <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
                  AI dosya notu: {visualNote}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h4 className="font-medium text-blue-800 text-sm mb-2">İlan Özeti</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>📍 {form.city}</p>
                {form.category === 'Araç' && form.brand && (
                  <p>🚗 {form.year} {form.brand} {form.model} — {Number(form.km).toLocaleString('tr-TR')} km</p>
                )}
                {form.category === 'Elektronik' && form.elecBrand && (
                  <p>📱 {form.elecBrand} {form.elecModel}
                    {form.storage && ` · ${form.storage}`}
                    {form.warranty !== 'Yok' && ` · Garanti: ${form.warranty}`}
                  </p>
                )}
                {form.category === 'Gayrimenkul' && form.netSqm && (
                  <p>🏠 {form.netSqm}m² {form.rooms} {form.propType}
                    {form.floor && ` · ${form.floor}. kat`}
                  </p>
                )}
                {form.estimatedValue && (
                  <p>💰 {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(form.estimatedValue))}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium py-3 rounded-xl transition-colors"
              >
                Geri
              </button>
              <button
                type="submit"
                disabled={!form.wantedFor}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                İlanı Yayınla
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
