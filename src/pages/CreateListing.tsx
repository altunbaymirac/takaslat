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
import { VEHICLE_GROUPS } from '../data/vehicleTypes';
import { VEHICLE_COLORS } from '../data/vehicleModels';
import { ELECTRONIC_BRANDS, getBrandsForVehicleGroup } from '../data/brands';
import { getModelsFromDB, getTrimsFromDB } from '../data/vehicleDatabase';
import { describeVehicleModelDefaults, getVehicleModelDefaults } from '../data/vehicleModelDefaults';
import { MAX_LISTING_VALUE, MIN_LISTING_VALUE, validateListingValue } from '../lib/listingValidation';
import { trackProductEvent } from '../lib/analytics';
import BrandPicker from '../components/BrandPicker';
import VehicleBodyDiagram from '../components/VehicleBodyDiagram';

const fuels: FuelType[] = ['Benzin', 'Dizel', 'LPG', 'Hibrit', 'Elektrik'];
const transmissions: TransmissionType[] = ['Manuel', 'Otomatik', 'Yarı Otomatik'];
const electronicTypes: ElectronicType[] = ['Telefon', 'Laptop', 'Tablet', 'Televizyon', 'Kulaklık', 'Konsol', 'Kamera', 'Akıllı Saat', 'Diğer'];
const warranties:      WarrantyStatus[] = ['Devam ediyor', 'Bitti', 'Yok'];
const accessoryOptions = ['Orijinal kutu', 'Şarj cihazı', 'Kulaklık', 'Adaptör', 'Kılıf', 'Kablo', 'Fatura'];

const propertyTypes: PropertyType[] = ['Daire', 'Villa', 'Müstakil Ev', 'Arsa', 'Dükkan', 'Ofis', 'Yazlık'];
const homePropertyTypes = propertyTypes.filter((type) => type !== 'Arsa');
const heatings:      HeatingType[]  = ['Doğalgaz Kombi', 'Merkezi', 'Klima', 'Soba', 'Yerden Isıtma', 'Yok'];
const titleDeeds:    TitleDeed[]    = ['Kat Mülkiyetli', 'Kat İrtifaklı', 'Hisseli', 'Müstakil Tapu', 'Arsa Tapulu'];
type ListingKind = 'Araç' | 'Ev' | 'Arsa';

interface FormData {
  title: string;
  category: Category;
  estimatedValue: string;
  description: string;
  wantedFor: string;
  city: string;
  condition: Condition;

  // Araç: temel
  brand: string;
  model: string;
  trim: string;
  year: string;
  km: string;
  fuel: FuelType;
  transmission: TransmissionType;
  color: string;
  hasAccidentRecord: boolean;
  bodyType: string;
  // Araç: teknik (opsiyonel)
  engineCC: string;
  power: string;
  driveType: string;
  numberOfDoors: string;
  // Araç: kaporta
  paintedParts: string[];
  changedParts: string[];
  // Araç: ekspertiz
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
  const [catalogHint, setCatalogHint] = useState('');
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
  const [form, setForm] = useState<FormData>({
    title: '',
    category: 'Araç',
    estimatedValue: '',
    description: '',
    wantedFor: '',
    city: 'İstanbul',
    condition: 'İyi',
    brand: '',
    model: '',
    trim: '',
    year: new Date().getFullYear().toString(),
    km: '',
    fuel: 'Benzin',
    transmission: 'Otomatik',
    color: '',
    hasAccidentRecord: false,
    bodyType: 'Sedan',
    engineCC: '',
    power: '',
    driveType: '',
    numberOfDoors: '',
    paintedParts: [],
    changedParts: [],
    hasExpertise: false,
    expertiseFirm: '',
    expertiseDate: '',
    expertiseNote: '',
    elecType: 'Telefon',
    elecBrand: '',
    elecModel: '',
    elecYear: new Date().getFullYear().toString(),
    storage: '',
    ram: '',
    screenSize: '',
    elecColor: '',
    os: '',
    batteryHealth: '',
    warranty: 'Yok',
    accessories: [],
    propType: 'Daire',
    netSqm: '',
    grossSqm: '',
    rooms: '2+1',
    buildingAge: '',
    floor: '',
    heating: 'Doğalgaz Kombi',
    furnished: false,
    balcony: true,
    elevator: false,
    parking: false,
    titleDeed: 'Kat Mülkiyetli',
    monthlyDues: '',
    previewImages: [],
    attachments: [],
  });

  useEffect(() => {
    const key = 'takaslat-listing-started';
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    trackProductEvent('listing_started');
  }, []);

  // Giriş yoksa hemen login'e yönlendir (son adımda değil)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentUser) {
        try { localStorage.setItem('takaslat-resume-after-login', '1'); } catch { /* */ }
        navigate('/login?redirect=/create');
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [currentUser, navigate]);

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
          queueMicrotask(() => {
            setForm(draft);
            if (draft.bodyType) {
              const grp = Object.entries(VEHICLE_GROUPS).find(([, types]) => types.includes(draft.bodyType))?.[0];
              if (grp) setVehicleGroup(grp);
            }
            setStep(3);
            showToast('Bilgilerin geri yüklendi, şimdi yayınlayabilirsin', 'success');
          });
          return;
        }
        // En az bir anlamlı içerik varsa göster
        if (draft.title || draft.description || draft.brand || draft.elecBrand || draft.netSqm) {
          queueMicrotask(() => setHasDraft(true));
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
      queueMicrotask(() => {
        setForm((f) => ({
          ...f,
          category:       src.category,
          condition:      src.condition,
          city:           src.city,
          estimatedValue: src.estimatedValue.toString(),
          description:    src.description,
          wantedFor:      src.wantedFor,
          title:          src.title + ' (Kopya)',
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
          elecType:  (src.electronicDetails?.type as typeof f.elecType) ?? f.elecType,
          elecBrand: src.electronicDetails?.brand   ?? f.elecBrand,
          elecModel: src.electronicDetails?.model   ?? f.elecModel,
          storage:   src.electronicDetails?.storage ?? f.storage,
          ram:       src.electronicDetails?.ram     ?? f.ram,
          warranty:  (src.electronicDetails?.warranty as typeof f.warranty) ?? f.warranty,
          propType:  (src.propertyDetails?.type as typeof f.propType) ?? f.propType,
          netSqm:    src.propertyDetails?.netSqm ? src.propertyDetails.netSqm.toString() : f.netSqm,
          rooms:     src.propertyDetails?.rooms ?? f.rooms,
        }));
        if (src.vehicleDetails?.bodyType) {
          const grp = Object.entries(VEHICLE_GROUPS).find(([, types]) => types.includes(src.vehicleDetails!.bodyType!))?.[0];
          if (grp) setVehicleGroup(grp);
        }
      });
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
        ? `${form.netSqm ? `${form.netSqm}m² ` : ''}${form.propType === 'Arsa' ? 'Arsa' : `${form.rooms} ${form.propType}`}`.trim()
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
            trim: form.trim || undefined,
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
            rooms: form.propType !== 'Arsa' ? form.rooms : undefined,
            buildingAge: form.propType !== 'Arsa' && form.buildingAge ? Number(form.buildingAge) : undefined,
            heating: form.propType !== 'Arsa' ? form.heating : undefined,
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

  const update = (key: keyof FormData, value: FormData[typeof key]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const listingKind: ListingKind =
    form.category === 'Gayrimenkul'
      ? form.propType === 'Arsa' ? 'Arsa' : 'Ev'
      : 'Araç';
  const isLandListing = listingKind === 'Arsa';

  function selectListingKind(kind: ListingKind) {
    setForm((current) => ({
      ...current,
      category: kind === 'Araç' ? 'Araç' : 'Gayrimenkul',
      propType: kind === 'Arsa'
        ? 'Arsa'
        : kind === 'Ev' && current.propType === 'Arsa'
        ? 'Daire'
        : current.propType,
      rooms: kind === 'Arsa' ? '' : current.rooms || '2+1',
      titleDeed: kind === 'Arsa' ? 'Arsa Tapulu' : current.titleDeed === 'Arsa Tapulu' ? 'Kat Mülkiyetli' : current.titleDeed,
    }));
  }

  function selectVehicleModel(model: string) {
    const defaults = getVehicleModelDefaults(vehicleGroup, form.brand, model);
    setForm((current) => ({
      ...current,
      model,
      trim: '',
      bodyType: defaults?.bodyType ?? current.bodyType,
      fuel: defaults?.fuel ?? current.fuel,
      transmission: defaults?.transmission ?? current.transmission,
      driveType: defaults?.driveType ?? current.driveType,
      numberOfDoors: defaults?.numberOfDoors ? String(defaults.numberOfDoors) : current.numberOfDoors,
    }));
    setCatalogHint(defaults ? describeVehicleModelDefaults(defaults) : '');
  }

  function selectVehicleTrim(trim: string) {
    const defaults = getVehicleModelDefaults(vehicleGroup, form.brand, form.model, trim);
    setForm((current) => ({
      ...current,
      trim,
      bodyType: defaults?.bodyType ?? current.bodyType,
      fuel: defaults?.fuel ?? current.fuel,
      transmission: defaults?.transmission ?? current.transmission,
      driveType: defaults?.driveType ?? current.driveType,
      numberOfDoors: defaults?.numberOfDoors ? String(defaults.numberOfDoors) : current.numberOfDoors,
    }));
    setCatalogHint(defaults ? describeVehicleModelDefaults(defaults) : '');
  }

  // Otomatik taslak: form değişikliğini gecikmeli olarak localStorage'a yaz.
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

      // Supabase Storage'a yükle ve kalıcı URL'lerle değiştir
      const permanentUrls = await uploadImages(files);
      update('previewImages', [
        ...form.previewImages.filter((u) => !u.startsWith('blob:')),
        ...permanentUrls,
      ].slice(0, 5));

      // AI görsel analizi (ilk fotoğraf)
      if (files[0]) {
        const note = await aiVisualDescription({ fileName: files[0].name, mimeType: files[0].type, size: files[0].size });
        setVisualNote(note.summary);
      }
      showToast('Fotoğraflar yüklendi', 'success');
    } catch {
      showToast('Yükleme başarısız. İnternet bağlantını kontrol et', 'error');
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
    if (form.wantedFor.trim().length < 20) {
      showToast('Takas beklentini en az 20 karakterle açıkla', 'error');
      return;
    }

    // Otomatik başlık
    let autoTitle = form.title;
    if (!autoTitle) {
      if (form.category === 'Araç')        autoTitle = `${form.year} ${form.brand} ${form.model}`;
      else if (form.category === 'Elektronik') autoTitle = `${form.elecBrand} ${form.elecModel}${form.storage ? ` ${form.storage}` : ''}`;
      else if (form.category === 'Gayrimenkul') {
        autoTitle = isLandListing
          ? `${form.city} ${form.netSqm ? `${form.netSqm}m² ` : ''}Arsa`
          : `${form.city} ${form.netSqm ? `${form.netSqm}m² ` : ''}${form.rooms ? `${form.rooms} ` : ''}${form.propType}`;
      }
      else                                 autoTitle = 'Takas İlanı';
    }
    autoTitle = autoTitle.trim().replace(/\s+/g, ' ');

    const estimatedValue = Number(form.estimatedValue);
    const valueError = validateListingValue(estimatedValue);
    if (valueError) {
      showToast(valueError, 'error');
      return;
    }
    if (autoTitle.length < 5 || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(autoTitle)) {
      showToast('İlan başlığı yeterli ürün bilgisi içermiyor', 'error');
      setStep(1);
      return;
    }
    if (form.description.trim().length < 30) {
      showToast('Açıklamayı en az 30 karakterle tamamla', 'error');
      setStep(2);
      return;
    }
    if (form.previewImages.length === 0) {
      showToast('İlanı yayınlamak için en az bir fotoğraf ekle', 'error');
      setStep(3);
      return;
    }

    // Tag'leri kategori bazlı oluştur
    const tags: string[] = [];
    if (form.category === 'Araç')        tags.push(form.fuel, form.transmission);
    if (form.category === 'Gayrimenkul') tags.push(form.propType, ...(isLandListing ? [] : [form.rooms]));

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
      grossSqm:     !isLandListing && form.grossSqm ? Number(form.grossSqm) : undefined,
      rooms:        !isLandListing && form.rooms ? form.rooms : undefined,
      buildingAge:  !isLandListing && form.buildingAge ? Number(form.buildingAge) : undefined,
      floor:        !isLandListing && form.floor ? form.floor : undefined,
      heating:      !isLandListing ? form.heating : undefined,
      furnished:    !isLandListing ? form.furnished : undefined,
      balcony:      !isLandListing ? form.balcony : undefined,
      elevator:     !isLandListing ? form.elevator : undefined,
      parking:      !isLandListing ? form.parking : undefined,
      titleDeed:    form.titleDeed,
      monthlyDues:  !isLandListing && form.monthlyDues ? Number(form.monthlyDues) : undefined,
    } : undefined;

    try {
      await addListing({
      title:          autoTitle,
      category:       form.category,
      estimatedValue,
      description:    form.description,
      wantedFor:      form.wantedFor,
      city:           form.city,
      condition:      form.condition,
      images: form.previewImages,
      tags: tags.filter(Boolean),
      vehicleDetails: form.category === 'Araç' ? {
        brand:             form.brand,
        model:             form.model,
        trim:              form.trim || undefined,
        year:              Number(form.year),
        km:                Number(form.km),
        fuel:              form.fuel,
        transmission:      form.transmission,
        color:             form.color,
        hasAccidentRecord: form.hasAccidentRecord,
        bodyType:          form.bodyType,
        engineCC:          form.engineCC    ? Number(form.engineCC)    : undefined,
        power:             form.power       ? Number(form.power)       : undefined,
        driveType:         form.driveType   || undefined,
        numberOfDoors:     form.numberOfDoors ? Number(form.numberOfDoors) : undefined,
        paintedParts:      form.paintedParts.length > 0 ? form.paintedParts : undefined,
        changedParts:      form.changedParts.length > 0 ? form.changedParts : undefined,
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
    <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Takas İlanı Ver</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Takas etmek istediğin ürünü listele</p>
      </div>

      {hasDraft && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-amber-700 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 3.75h9.879c.298 0 .584.119.795.33l3.246 3.246c.211.211.33.497.33.795V18A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75zM8.25 3.75v4.5h7.5v-4.5M8.25 20.25v-6h7.5v6" />
            </svg>
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
              Geri Yükle
            </button>
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="mb-5 flex items-center gap-2">
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
          {step === 1 ? 'Kategori & Detaylar' : step === 2 ? 'Fiyat & Açıklama' : 'Fotoğraf & Takas Tercihi'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="-mx-4 bg-white px-4 py-6 dark:bg-slate-900 sm:mx-0 sm:px-6">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">İlan Türü *</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { kind: 'Araç', label: 'Araç', detail: 'Otomobil ve taşıt' },
                  { kind: 'Ev', label: 'Ev', detail: 'Daire, villa, yazlık' },
                  { kind: 'Arsa', label: 'Arsa', detail: 'İmarlı veya tarla' },
                ] as { kind: ListingKind; label: string; detail: string }[]).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => selectListingKind(item.kind)}
                    className={`min-h-16 rounded-md border px-3 py-2.5 text-left transition-colors ${
                      listingKind === item.kind
                        ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-600 dark:bg-blue-900/25 dark:text-blue-200'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="block text-sm font-bold">{item.label}</span>
                    <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">{item.detail}</span>
                  </button>
                ))}
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
                        onClick={() => {
                          setVehicleGroup(group);
                          setCatalogHint('');
                          setForm((current) => ({
                            ...current,
                            bodyType: types[0],
                            brand: '',
                            model: '',
                            trim: '',
                          }));
                        }}
                        className={`flex items-center justify-center rounded-md border px-2 py-2.5 transition-colors ${
                          vehicleGroup === group
                            ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600 dark:bg-blue-900/20 dark:text-blue-300'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'
                        }`}
                      >
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

                    {/* 3. Marka → Seri → Donanım */}
                    {(() => {
                      const modelList = form.brand ? getModelsFromDB(vehicleGroup, form.brand) : [];
                      const trimList  = form.brand && form.model ? getTrimsFromDB(vehicleGroup, form.brand, form.model) : [];
                      return (
                        <div className="space-y-4">
                          {/* Marka */}
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Marka *</label>
                            <BrandPicker
                              required
                              value={form.brand}
                              onChange={(brand) => {
                                setCatalogHint('');
                                setForm((current) => ({ ...current, brand, model: '', trim: '' }));
                              }}
                              brands={getBrandsForVehicleGroup(vehicleGroup)}
                              placeholder="Toyota, BMW..."
                            />
                          </div>

                          {/* Seri */}
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Model *</label>
                            {modelList.length > 0 ? (
                              <select
                                required
                                value={form.model}
                                onChange={(e) => selectVehicleModel(e.target.value)}
                                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Model seçin</option>
                                {modelList.map(m => <option key={m} value={m}>{m}</option>)}
                                <option value="Diğer">Diğer (elle gir)</option>
                              </select>
                            ) : (
                              <input
                                required
                                type="text"
                                placeholder="Corolla, 320i, Clio..."
                                value={form.model}
                                onChange={(e) => selectVehicleModel(e.target.value)}
                                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                            {form.model === 'Diğer' && (
                              <input
                                type="text"
                                placeholder="Model adını girin..."
                                className="w-full mt-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onBlur={(e) => { if (e.target.value) selectVehicleModel(e.target.value); }}
                              />
                            )}
                          </div>

                          {/* Donanım / Paket */}
                          {(trimList.length > 0 || (form.model && form.model !== 'Diğer')) && (
                            <div>
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                                Donanım / Paket <span className="text-slate-400 font-normal">(opsiyonel)</span>
                              </label>
                              {trimList.length > 0 ? (
                                <select
                                  value={form.trim}
                                  onChange={(e) => selectVehicleTrim(e.target.value)}
                                  className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">Donanım seçin</option>
                                  {trimList.map(t => <option key={t} value={t}>{t}</option>)}
                                  <option value="Diğer">Diğer</option>
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Comfortline, R-Line, M Sport..."
                                  value={form.trim}
                                  onChange={(e) => selectVehicleTrim(e.target.value)}
                                  className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              )}
                            </div>
                          )}
                          {catalogHint && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
                              Katalogdan dolduruldu: {catalogHint}. Alanları istersen değiştirebilirsin.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* 4. Yıl + KM + Renk */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                        <select
                          value={form.color}
                          onChange={(e) => update('color', e.target.value)}
                          className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Renk seçin…</option>
                          {VEHICLE_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
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
                        Tramer / hasar kaydı var
                      </label>
                    </div>

                    {/* 7. Kaporta durumu */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Kaporta Durumu</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Boyalı = orijinal boya dışı boya yapılmış · Değişen = panel değiştirilmiş
                      </p>
                      <VehicleBodyDiagram
                        paintedParts={form.paintedParts}
                        changedParts={form.changedParts}
                        onPaintedChange={(p) => update('paintedParts', p)}
                        onChangedChange={(p) => update('changedParts', p)}
                      />
                    </div>

                    {/* 8. Ekspertiz */}
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
                {!isLandListing && (
                  <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Mülk Türü</label>
                  <div className="flex flex-wrap gap-1.5">
                    {homePropertyTypes.map((t) => (
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
                )}

                <div className={`grid gap-4 ${isLandListing ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                      {isLandListing ? 'Arsa m² *' : 'Net m² *'}
                    </label>
                    <input required type="number" placeholder="120"
                      value={form.netSqm}
                      onChange={(e) => update('netSqm', e.target.value)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {!isLandListing && (
                    <>
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
                    </>
                  )}
                </div>

                {!isLandListing && (
                  <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  </>
                )}

                <div className={`grid gap-4 ${isLandListing ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {!isLandListing && (
                    <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Isıtma</label>
                    <select value={form.heating}
                      onChange={(e) => update('heating', e.target.value as HeatingType)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {heatings.map((h) => <option key={h}>{h}</option>)}
                    </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Tapu Durumu</label>
                    <select value={form.titleDeed}
                      onChange={(e) => update('titleDeed', e.target.value as TitleDeed)}
                      className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {titleDeeds.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {!isLandListing && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'furnished' as const, label: 'Eşyalı' },
                    { key: 'balcony'   as const, label: 'Balkon' },
                    { key: 'elevator'  as const, label: 'Asansör' },
                    { key: 'parking'   as const, label: 'Otopark' },
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
                )}
              </>
            )}

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
                  form.category === 'Gayrimenkul'
                    ? isLandListing
                      ? `${form.netSqm || ''}m² Arsa`
                      : `${form.netSqm || ''}m² ${form.rooms} ${form.propType}`
                    :
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
                    {aiLoading ? 'Hesaplanıyor…' : 'AI ile hesapla'}
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₺</span>
                <input
                  required
                  type="number"
                  min={MIN_LISTING_VALUE}
                  max={MAX_LISTING_VALUE}
                  step="1000"
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
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Minimum ilan değeri ₺1.000</p>
              {valueHint && (
                <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                  <p className="font-semibold text-emerald-800 mb-0.5">AI Değer Aralığı ({valueHint.basedOn} ilan)</p>
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
                minLength={20}
                maxLength={500}
                rows={3}
                placeholder="Hangi araç veya ürünle takas yapmak istiyorsunuz? Fiyat farkı öder misiniz? Örn: 'SUV veya crossover, max 100k TL fark öderim.'"
                value={form.wantedFor}
                onChange={(e) => update('wantedFor', e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className={form.wantedFor.trim().length < 20 ? 'text-amber-600' : 'text-emerald-600'}>
                  {form.wantedFor.trim().length < 20 ? 'Ne istediğini ve nakit fark tercihini açıkla' : 'Beklenti yeterince açık'}
                </span>
                <span className="text-slate-400">{form.wantedFor.length}/500</span>
              </div>
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
                <p>Konum: {form.city}</p>
                {form.category === 'Araç' && form.brand && (
                  <p>Araç: {form.year} {form.brand} {form.model}, {Number(form.km).toLocaleString('tr-TR')} km</p>
                )}
                {form.category === 'Elektronik' && form.elecBrand && (
                  <p>Ürün: {form.elecBrand} {form.elecModel}
                    {form.storage && ` · ${form.storage}`}
                    {form.warranty !== 'Yok' && ` · Garanti: ${form.warranty}`}
                  </p>
                )}
                {form.category === 'Gayrimenkul' && form.netSqm && (
                  <p>Gayrimenkul: {form.netSqm}m² {isLandListing ? 'Arsa' : `${form.rooms} ${form.propType}`}
                    {!isLandListing && form.floor && ` · ${form.floor}. kat`}
                  </p>
                )}
                {form.estimatedValue && (
                  <p>Değer: {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Number(form.estimatedValue))}</p>
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
                disabled={form.wantedFor.trim().length < 20}
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
