"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-context";
import ChildInteractiveDonate from "@/components/home/ChildInteractiveDonate";
import InteractiveGallery from "@/components/home/interactive-gallery";
import IconFeatureCard from "@/components/home/icon-feature-card";
import ScrollReveal from "@/components/ui/scroll-reveal";
import CountUp from "@/components/ui/count-up";
import FloatingActionBar from "@/components/layout/floating-action-bar";
import QuickDonationCarousel from "@/components/home/quick-donation-carousel";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_E164 } from "@/lib/contact";

const donationTabs = [
  { label: "Kurban", icon: "qurbani" },
  { label: "Mescid", icon: "temple_hindu" },
  { label: "Medrese", icon: "school" },
  { label: "Yetim", icon: "child_care" },
  { label: "Su Kuyusu", icon: "water_drop" },
  { label: "Acil Yardım", icon: "emergency" },
  { label: "Sadaka", icon: "volunteer_activism" },
];

type DonationAreaCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  image: string | null;
};

type HomeNewsPost = {
  id: string; slug: string; title: string; excerpt: string;
  coverImageUrl: string; coverImageAlt: string; publishedAt: string;
};

const stories = [
  {
    quote: "Mizan Derneği sayesinde köylerimizde artık temiz su akıyor. Çocuklarımız hastalıklarla boğuşmuyor. Teşekkürler Elbistan, teşekkürler Türkiye.",
    author: "Abdullah J.",
    role: "Yerel Köy Muhtarı, Çad",
    initial: "A",
    rating: 5,
  },
  {
    quote: "Gönüllü olarak katıldığım bu yardım seferberliğinde, bir yetimin yüzündeki gülümseme her şeye değerdi. Şeffaf ve dürüst çalışmanın karşılığı buydu.",
    author: "Mustafa K.",
    role: "Gönüllü Yardımsever",
    initial: "M",
    rating: 5,
  },
  {
    quote: "Bir tabak sıcak yemeğin, bir talebenin duasına dönüşmesine burada şahit oldum. Mizan Derneği, iyiliği gerçekten yaşatıyor.",
    author: "Ayşe H.",
    role: "Gönüllü",
    initial: "A",
    rating: 5,
  },
];

export default function HomePage() {
  const { t, dir, locale } = useLanguage();
  const [donationAreas, setDonationAreas] = useState<DonationAreaCard[]>([]);
  const [donationAreasLoading, setDonationAreasLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    { img: "/images/home/hero-community-meal.png", title: t("home.heroTitle"), desc: t("home.heroDescription1") },
    { img: "/images/home/hero-qurbani.jpeg", title: t("home.heroTitle2"), desc: t("home.heroDescription2") },
    { img: "/images/home/hero-student-support.jpeg", title: t("home.heroTitle3"), desc: t("home.heroDescription3") },
    { img: "/images/home/hero-mizan-mescidi.png", title: t("home.heroTitle4"), desc: t("home.heroDescription4") },
  ];
  const goToSlide = (index: number) => setCurrentSlide(index);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const [activeTab, setActiveTab] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);
  const donationTabs = ["qurbani", "temple_hindu", "school", "child_care", "water_drop", "emergency", "volunteer_activism"].map((icon, index) => ({
    icon,
    label: t(`home.quickDonationCategories.${index}`),
  }));
  const [newsResult, setNewsResult] = useState<{ locale: string; posts: HomeNewsPost[] } | null>(null);
  const news = newsResult?.locale === locale ? newsResult.posts : [];
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/news/popular?locale=${locale}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("News unavailable"); return response.json(); })
      .then(data => { if (!controller.signal.aborted) setNewsResult({ locale, posts: data.posts }); })
      .catch(() => { if (!controller.signal.aborted) setNewsResult({ locale, posts: [] }); });
    return () => controller.abort();
  }, [locale]);
  const stories = ["A", "M", "A"].map((initial, index) => ({
    initial,
    rating: 5,
    quote: t(`home.storiesItems.${index}.quote`),
    author: t(`home.storiesItems.${index}.author`),
    role: t(`home.storiesItems.${index}.role`),
  }));

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % stories.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [stories.length]);

  useEffect(() => {
    let active = true;
    async function loadDonationAreas() {
      try {
        const response = await fetch(`/api/bagis-alanlari?locale=${locale}`, { cache: "no-store" });
        const payload = await response.json();
        if (!active) return;
        const areas = Array.isArray(payload?.areas) ? payload.areas : [];
        setDonationAreas(
          areas.slice(0, 3).map((area: {
            id?: string;
            slug?: string;
            title?: string;
            excerpt?: string;
            category?: { name?: string } | null;
            image?: { src?: string } | null;
            collectedAmount?: number;
            targetAmount?: number;
            progress?: number;
          }) => ({
            id: String(area.id || area.title || Math.random()),
            slug: area.slug || String(area.id || area.title || Math.random()),
            title: area.title || t("home.donationAreaFallback"),
            excerpt: area.excerpt || "",
            category: area.category?.name || t("home.donationCategoryFallback"),
            image: area.image?.src || null,
          })),
        );
      } catch {
        if (active) setDonationAreas([]);
      } finally {
        if (active) setDonationAreasLoading(false);
      }
    }

    loadDonationAreas();
    return () => {
      active = false;
    };
  }, [locale, t]);

  return (
    <div className="overflow-x-hidden" dir={dir}>
      {/* HERO */}
      <section className="relative h-[560px] overflow-hidden sm:h-[600px] lg:h-[700px]">
        <AnimatePresence>
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: "-100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="absolute inset-0 bg-cover bg-[center_35%]"
            style={{ backgroundImage: `url(${slides[currentSlide].img})` }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 mx-auto flex h-full max-w-[1140px] items-center px-5 sm:px-8 lg:px-2.5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-6 items-center w-full">
            <div className="max-w-lg lg:max-w-none">
              <AnimatePresence mode="wait">
                <motion.div key={currentSlide}>
                  <motion.h5
                    initial={{ opacity: 0, x: -100 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="text-gold text-base uppercase tracking-[0.2em] font-medium mb-5"
                  >
                    {t(`home.heroBadge${currentSlide + 1}`)}
                  </motion.h5>

                  <motion.h1
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="text-display-lg max-sm:text-display-lg-mobile text-white leading-[1.08] mb-5 max-w-[560px]"
                  >
                    {slides[currentSlide].title}
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, x: 60 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="text-base text-white/60 leading-relaxed mb-7 max-w-[480px]"
                  >
                    {slides[currentSlide].desc}
                  </motion.p>

                  <div className="flex flex-wrap gap-3 sm:gap-5">
                    <motion.div
                      initial={{ opacity: 0, x: -100 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 2, ease: "easeOut" }}
                    >
                      <Link
                        href="/bagis"
                        className="inline-flex min-h-12 items-center justify-center gap-2 bg-secondary px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:px-10 sm:py-5 sm:text-base"
                      >
                        {t("common.donate")} →
                      </Link>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: 60 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 2, delay: 1, ease: "easeOut" }}
                    >
                      <Link
                        href="/hakkimizda"
                        className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/10 sm:px-10 sm:py-5 sm:text-base"
                      >
                        {t("common.learnMore")} →
                      </Link>
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="hidden lg:block" />
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              className={cn(
                "rounded-full transition-all duration-500",
                i === currentSlide
                  ? "bg-white w-10 h-2.5"
                  : "bg-white/40 w-2.5 h-2.5 hover:bg-white/60"
              )}
              aria-label={t("home.slideLabel").replace("{number}", String(i + 1))}
            />
          ))}
        </div>
      </section>

      {/* HERO BOTTOM INFO CARDS */}
      <section className="py-16 lg:py-20 bg-white">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative isolate overflow-hidden rounded-[28px] bg-[#FAF7F1] p-8 shadow-[0_18px_45px_rgba(73,54,30,0.08)] sm:p-10 lg:p-12"
              data-home-intro-card
            >
              <div
                aria-hidden="true"
                data-intro-card-background
                className="pointer-events-none absolute inset-0 bg-[url('/images/home/mizan-adalet-ve-denge-bg.png')] bg-cover bg-[position:78%_center] bg-no-repeat"
              />
              <div className="relative z-10 max-w-[430px]">
                <h3 className="text-headline-md text-on-surface mb-4">
                  {t("about.title")}
                </h3>
                <p className="text-base text-on-surface-variant/70 leading-relaxed mb-8">
                  {t("home.introDescription")}
                </p>
                <div className="space-y-3 mb-8">
                  {[
                    t("home.introItems.0"),
                    t("home.introItems.1"),
                    t("home.introItems.2"),
                    t("home.introItems.3"),
                    t("home.introItems.4"),
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
                      <span className="text-base text-on-surface-variant/75">{item}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/hakkimizda"
                  className="inline-flex items-center gap-2 bg-secondary text-white px-7 py-3.5 rounded-full text-[15px] font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  {t("home.meetFoundation")}
                  <span className="text-base">→</span>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 80 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
              className="relative isolate overflow-hidden rounded-[28px] bg-primary-container p-8 shadow-[0_18px_45px_rgba(31,76,53,0.12)] sm:p-10 lg:p-12"
              data-home-contact-card
            >
              <div
                aria-hidden="true"
                data-contact-card-background
                className="pointer-events-none absolute inset-0 scale-[1.08] bg-[url('/images/home/sosyal-yardim.webp')] bg-cover bg-[position:70%_center] bg-no-repeat opacity-[0.50] blur-md"
              />
              <div className="relative z-10 max-w-[430px]">
                <div className="flex items-start gap-5 mb-6">
                  <span className="material-symbols-outlined text-[32px] text-primary">volunteer_activism</span>
                  <div>
                    <h3 className="text-headline-md text-on-surface mb-2">
                      {t("home.donationContactTitle")}
                    </h3>
                    <p className="text-base text-on-surface-variant/80 leading-relaxed">
                      {t("home.donationContactDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-on-surface-variant mt-4">
                  <span className="material-symbols-outlined text-primary">phone_in_talk</span>
                  <a href={`tel:${SUPPORT_PHONE_E164}`} className="text-lg font-semibold hover:text-gold transition-colors">
                    {SUPPORT_PHONE_DISPLAY}
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ABOUT / ICON FEATURES */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <ScrollReveal>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
              <div>
                <motion.span
                  initial={{ x: -80, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="inline-flex items-center gap-3 text-gold text-label-sm uppercase tracking-[0.15em] font-medium mb-4"
                >
                  <span className="w-8 h-[2px] bg-gold rounded-full" />
                  {t("home.aboutEyebrow")}
                </motion.span>
                <h2 className="text-headline-xl text-on-surface leading-tight mb-6">
                  {t("home.aboutHeading")}
                </h2>
                <p className="text-base text-on-surface-variant/60 leading-relaxed mb-10 max-w-lg">
                  {t("home.aboutDescription")}
                </p>

                <div className="space-y-6"
                  onMouseLeave={() => setHoveredFeature(null)}
                >
                  {[
                    {
                      icon: "school",
                      title: t("home.aboutFeatures.0.title"),
                      desc: t("home.aboutFeatures.0.description"),
                    },
                    {
                      icon: "volunteer_activism",
                      title: t("home.aboutFeatures.1.title"),
                      desc: t("home.aboutFeatures.1.description"),
                    },
                    {
                      icon: "verified_user",
                      title: t("home.aboutFeatures.2.title"),
                      desc: t("home.aboutFeatures.2.description"),
                    },
                  ].map((item, i) => {
                    const isActive = hoveredFeature === i || (hoveredFeature === null && i === 0);
                    return (
                    <div
                      key={i}
                      className="flex gap-4 group"
                      onMouseEnter={() => setHoveredFeature(i)}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ease-out",
                        isActive ? "bg-primary text-white" : "bg-surface text-primary",
                      )}>
                        <span className="material-symbols-outlined text-[24px]">
                          {item.icon}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-on-surface mb-1">{item.title}</h4>
                        <p className="text-base text-on-surface-variant/55 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-8 mt-8">
                  <Link
                    href="/hakkimizda"
                    className="inline-flex items-center gap-2 bg-secondary text-white px-7 py-3.5 rounded-full text-[15px] font-semibold hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 shrink-0"
                  >
                    {t("home.getToKnowUs")}
                  </Link>
                  <div className="hidden lg:flex items-center gap-3.5">
                    <div className="w-[52px] h-[52px] rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-xl">M</span>
                    </div>
                    <div>
                      <p className="text-[18px] font-semibold leading-tight text-on-surface">Mizan Derneği</p>
                      <p className="text-[16px] text-on-surface-variant mt-1">{t("home.motto")}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="relative aspect-[3/4] overflow-hidden rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.08)]">
                  <Image
                  src="/images/home/about-quran-student-original.webp"
                    alt={t("home.aboutHeading")}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* IMPACT STATS */}
      <section className="bg-white pb-14 pt-8 sm:pb-20 sm:pt-12 lg:pb-28">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-margin-desktop">
          <div className="mx-auto mb-6 max-w-xl text-center sm:mb-10">
            <h2 className="text-3xl leading-tight text-on-surface sm:text-headline-xl">
              {t("home.statsHeading")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant/60 sm:mt-3 sm:text-base">
              {t("home.statsDescription")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4 lg:gap-8">
            {[
              { icon: "send", value: 954, suffix: "+", label: t("home.shipments"), sublabel: t("home.statSublabels.0") },
              { icon: "group", value: 3588, suffix: "", label: t("home.supporters"), sublabel: t("home.statSublabels.1") },
              { icon: "public", value: 10, suffix: "+", label: t("home.countries"), sublabel: t("home.statSublabels.2") },
              { icon: "history", value: "2023", suffix: "", label: t("home.activeSince"), sublabel: t("home.statSublabels.3") },
            ].map((stat, i) => (
              <div
                key={i}
                className="flex flex-col items-center rounded-2xl bg-primary p-4 text-center shadow-md transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl sm:rounded-3xl sm:p-7 lg:p-10"
              >
                <span className="material-symbols-outlined text-[28px] text-white sm:text-[36px] lg:text-[44px]">
                  {stat.icon}
                </span>
                <h4 className="mt-3 text-2xl font-bold text-white sm:mt-4 sm:text-4xl lg:mt-6 lg:text-5xl">
                  {typeof stat.value === "string" ? stat.value : <CountUp end={stat.value} suffix={stat.suffix} />}
                </h4>
                <p className="mt-2 text-xs font-medium text-white/85 sm:text-base">{stat.label}</p>
                <p className="mt-1 hidden text-sm text-white/50 sm:block">{stat.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTERACTIVE GALLERY TABS */}
      <InteractiveGallery
        tabs={[
          {
            id: "medrese",
            label: t("home.gallery.0"),
            image: "/images/home/gallery-medrese-1080p.webp",
          },
          {
            id: "talebe",
            label: t("home.gallery.1"),
            image: "/images/home/gallery-talebe-1080p.webp",
          },
          {
            id: "asevi",
            label: t("home.gallery.2"),
            image: "/images/home/gallery-asevi-1080p.webp",
          },
          {
            id: "yardim",
            label: t("home.gallery.3"),
            image: "/images/home/gallery-sosyal-yardim-1080p.webp",
          },
        ]}
      />

      {/* CAMPAIGNS */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-14 gap-4">
            <div>
              <span className="inline-flex items-center gap-3 text-gold text-label-sm uppercase tracking-[0.15em] font-medium mb-4">
                <span className="w-8 h-[2px] bg-gold rounded-full" />
                {t("home.donationAreasEyebrow")}
              </span>
              <h2 className="text-headline-xl text-on-surface leading-tight">
                {t("home.donationAreasEyebrow")}
              </h2>
              <p className="text-base text-on-surface-variant/60 mt-3 max-w-md leading-relaxed">
                {t("home.donationAreasDescription")}
              </p>
            </div>
            <Link
              href="/bagis"
              className="inline-flex items-center gap-2 border-2 border-outline-variant/25 text-on-surface-variant/70 px-7 py-3.5 rounded-full text-[15px] font-semibold hover:border-primary/40 hover:text-primary hover:-translate-y-0.5 transition-all duration-200 shrink-0"
            >
                {t("home.allDonationAreas")}
              <span className="text-lg ml-0.5">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-12">
            {donationAreasLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-outline-variant/20 bg-white p-6">
                  <div className="h-56 rounded-2xl bg-surface-container-high animate-pulse" />
                  <div className="mt-6 space-y-3">
                    <div className="h-5 w-2/3 rounded bg-surface-container-high animate-pulse" />
                    <div className="h-4 w-full rounded bg-surface-container-high animate-pulse" />
                    <div className="h-4 w-5/6 rounded bg-surface-container-high animate-pulse" />
                  </div>
                </div>
              ))
            ) : donationAreas.length ? (
              donationAreas.map((area) => (
                <div key={area.id} className="relative group/card">
                  <div className="absolute -inset-x-6 -inset-y-10 rounded-[40px] bg-[radial-gradient(circle,rgba(14,90,58,.18)_0%,rgba(172,120,15,.08)_45%,transparent_75%)] opacity-0 group-hover/card:opacity-100 blur-3xl transition-opacity duration-500 pointer-events-none z-0" />
                  <div className="relative z-10 bg-white rounded-3xl overflow-hidden shadow-lg group-hover/card:shadow-2xl transition-all duration-500 ease-out group-hover/card:scale-105 group-hover/card:-translate-y-3 cursor-pointer">
                    <div className="relative h-56 overflow-hidden">
                      {area.image ? (
                        <Image
                          alt={area.title}
                          src={area.image}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="object-cover group-hover/card:scale-110 transition-transform duration-700 ease-out"
                        />
                      ) : (
                        <div className="h-full w-full bg-[linear-gradient(135deg,_rgba(14,90,58,.14),_rgba(172,120,15,.14))]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
                      <span className="absolute top-4 left-4 bg-white/80 backdrop-blur-md text-primary px-4 py-1.5 rounded-full text-label-sm font-semibold shadow-sm group-hover/card:shadow-lg transition-shadow duration-500">
                        {area.category}
                      </span>
                    </div>

                    <div className="p-6 flex flex-col">
                      <h3 className="text-headline-md text-on-surface mb-2 group-hover/card:text-primary transition-colors duration-200 leading-snug">
                        {area.title}
                      </h3>
                      <p className="text-base text-on-surface-variant/55 leading-relaxed mb-6 line-clamp-2">
                        {area.excerpt}
                      </p>

                      <div className="mt-auto">
                        <Link
                          href={`/bagis/${area.slug}`}
                          className="group/btn mt-1 inline-flex items-center justify-center gap-2 bg-secondary text-white px-6 py-3.5 rounded-full text-[15px] font-semibold hover:shadow-lg hover:shadow-secondary/25 group-hover/card:scale-105 transition-all duration-300"
                        >
                          <span className="material-symbols-outlined text-[18px]">volunteer_activism</span>
                          {t("common.donate")}
                          <span className="text-base transition-transform duration-300 group-hover/btn:translate-x-1">→</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="md:col-span-2 lg:col-span-3 rounded-3xl border border-dashed border-outline-variant/30 bg-white p-8 text-center text-on-surface-variant">
                {t("home.noDonationAreas")}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* QUICK DONATION CATEGORIES */}
      <section className="relative bg-white pb-14 pt-8 sm:pb-20 sm:pt-12 lg:pb-28 lg:pt-16">
        <div className="mx-auto max-w-container-max px-5 sm:px-margin-desktop">
          <div className="mb-7 text-center sm:mb-10">
            <h2 className="mx-auto max-w-3xl text-3xl font-bold leading-[1.08] text-on-surface sm:text-4xl lg:text-5xl">
              {t("home.quickDonationHeading")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant/60 sm:mt-6 sm:text-base">
              {t("home.quickDonationDescription")}
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <QuickDonationCarousel
              categories={donationTabs}
              activeIndex={activeTab}
              onSelect={setActiveTab}
            />
          </div>
        </div>
      </section>

      {/* DONATION PROCESS + CTA BANNER */}
      <section className="bg-[#f4f0e9] py-14 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-container-max px-5 sm:px-margin-desktop">
          <ScrollReveal>
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div className="relative min-h-[360px] overflow-hidden rounded-[28px] bg-[#8b927d] shadow-[0_18px_50px_rgba(65,55,43,0.2)] sm:min-h-[440px] lg:min-h-[540px]">
                <Image
                  src="/images/home/donation-process-africa-original-v3-1080p.webp"
                  alt={t("home.donationContactTitle")}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#2d2923]/90 via-[#3f463b]/20 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-[#e4d4ba]/30 bg-[#302b25]/85 p-5 text-[#fffaf2] shadow-xl backdrop-blur-md sm:inset-x-6 sm:bottom-6 sm:p-7">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#e3c99f]">Mizan Derneği</p>
                  <h3 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{t("home.processCardTitle")}</h3>
                  <Link
                    href="/bagis"
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#f4e9d7] px-6 py-3 text-sm font-bold text-[#332a22] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg sm:w-auto"
                  >
                    {t("home.processCardButton")}
                    <span className="text-base">→</span>
                  </Link>
                </div>
              </div>

              <div className="lg:py-5">
                <span className="inline-flex items-center gap-3 text-gold text-label-sm uppercase tracking-[0.15em] font-medium mb-4">
                  <span className="w-8 h-[2px] bg-gold rounded-full" />
                  {t("home.processEyebrow")}
                </span>
                <h2 className="text-3xl font-bold leading-[1.1] text-on-surface sm:text-4xl lg:text-5xl">
                  {t("home.processHeading")}
                </h2>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-on-surface-variant/70 sm:text-lg">
                  {t("home.processDescription")}
                </p>

                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  {[
                    {
                      step: "01",
                      icon: "touch_app",
                      title: t("home.processSteps.0.title"),
                      desc: t("home.processSteps.0.description"),
                    },
                    {
                      step: "02",
                      icon: "description",
                      title: t("home.processSteps.1.title"),
                      desc: t("home.processSteps.1.description"),
                    },
                    {
                      step: "03",
                      icon: "volunteer_activism",
                      title: t("home.processSteps.2.title"),
                      desc: t("home.processSteps.2.description"),
                    },
                    {
                      step: "04",
                      icon: "eco",
                      title: t("home.processSteps.3.title"),
                      desc: t("home.processSteps.3.description"),
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="group flex gap-4 rounded-2xl border border-[#ded2c0] bg-[#fffdf9] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#9b7955]/45 hover:shadow-md"
                    >
                      <div className="shrink-0">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-[#d9c7aa]/35 transition-all duration-300 group-hover:scale-105 group-hover:bg-[#5f594a] group-hover:text-white">
                          <span className="material-symbols-outlined text-[22px] text-[#6d563f] group-hover:text-white">{item.icon}</span>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-bold tracking-[0.12em] text-[#9b6638]">{item.step}</p>
                        <h4 className="text-sm font-bold text-on-surface sm:text-base">{item.title}</h4>
                        <p className="mt-1 text-sm leading-relaxed text-on-surface-variant/65">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* NEWS */}
      {news.length > 0 ? <section className="py-20 lg:py-28 bg-surface-container-low">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="inline-flex items-center justify-center gap-3 text-gold text-label-sm uppercase tracking-[0.15em] font-medium mb-4">
              <span className="w-8 h-[2px] bg-gold rounded-full" />
              {t("home.newsEyebrow")}
            </span>
            <h2 className="text-headline-xl text-on-surface leading-tight">
              {t("home.news")}
            </h2>
            <p className="text-base text-on-surface-variant/60 mt-4 leading-relaxed">
              {t("home.newsDescription")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {news.map((item) => (
              <Link
                href={`/haberler/${item.slug}`}
                key={item.id}
                className="group bg-white rounded-3xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(0,0,0,0.08)] transition-all duration-500 hover:-translate-y-1 cursor-pointer"
              >
                <div className="relative aspect-video overflow-hidden bg-surface-container-high">
                                    {item.coverImageUrl ? <Image
                    className="object-cover group-hover:scale-105 transition-transform duration-[1200ms] ease-out"
                    src={item.coverImageUrl}
                    alt={item.coverImageAlt}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                  /> : <span aria-hidden="true" className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-5xl text-primary/30">newspaper</span>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>

                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary/60">calendar_today</span>
                    <span className="text-label-sm text-on-surface-variant/60">{new Date(item.publishedAt).toLocaleDateString(locale === "tr" ? "tr-TR" : locale === "ar" ? "ar" : "en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" })}</span>
                  </div>

                  <h4 className="text-headline-md text-on-surface group-hover:text-primary transition-colors duration-200 leading-snug line-clamp-2">
                    {item.title}
                  </h4>

                  <p className="text-base text-on-surface-variant/55 leading-relaxed line-clamp-2">
                    {item.excerpt}
                  </p>

                  <div className="flex items-center gap-1.5 text-label-sm font-semibold text-primary pt-1 group-hover:gap-3 transition-all duration-300">
                    {t("common.readMore")}
                    <span className="text-base">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section> : null}

      {/* STORIES */}
      <section className="py-20 lg:py-28 bg-surface-container-low">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="text-center max-w-xl mx-auto mb-14">
            <span className="inline-flex items-center justify-center gap-3 text-gold text-label-sm uppercase tracking-[0.15em] font-medium mb-4">
              <span className="w-8 h-[2px] bg-gold rounded-full" />
              {t("home.storiesEyebrow")}
            </span>
            <h2 className="text-headline-xl text-on-surface leading-tight">
              {t("home.stories")}
            </h2>
            <p className="text-base text-on-surface-variant/60 mt-4 leading-relaxed">
              {t("home.storiesDescription")}
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTestimonial}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="bg-white p-10 rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.04)] text-center relative"
              >
                <span className="material-symbols-outlined text-[64px] text-gold/15 mb-6 block">
                  format_quote
                </span>

                <div className="flex justify-center gap-1 mb-6">
                  {Array.from({ length: stories[activeTestimonial].rating }).map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-gold"
                      fill="currentColor"
                      viewBox="0 0 576 512"
                    >
                      <path d="M259.3 17.8L194 150.2 47.9 171.5c-26.2 3.8-36.7 36.1-17.7 54.6l105.7 103-25 145.5c-4.5 26.3 23.2 46 46.4 33.7L288 439.6l130.7 68.7c23.2 12.2 50.9-7.4 46.4-33.7l-25-145.5 105.7-103c19-18.5 8.5-50.8-17.7-54.6L382 150.2 316.7 17.8c-11.7-23.6-45.6-23.9-57.4 0z" />
                    </svg>
                  ))}
                </div>

                <p className="text-lg text-on-surface/75 italic leading-relaxed mb-8 max-w-lg mx-auto">
                  &ldquo;{stories[activeTestimonial].quote}&rdquo;
                </p>

                <div className="flex items-center justify-center gap-4 pt-6 border-t border-outline-variant/10">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/10 to-gold/10 flex items-center justify-center font-bold text-primary text-xl">
                    {stories[activeTestimonial].initial}
                  </div>
                  <div className="text-left">
                    <p className="text-label-md font-semibold text-on-surface">
                      {stories[activeTestimonial].author}
                    </p>
                    <p className="text-label-sm text-on-surface-variant/60">
                      {stories[activeTestimonial].role}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-3 mt-8">
              {stories.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTestimonial(i)}
                  className={`rounded-full transition-all duration-500 ${
                    i === activeTestimonial
                      ? "bg-primary w-8 h-2.5"
                      : "bg-outline-variant/30 w-2.5 h-2.5 hover:bg-outline-variant/60"
                  }`}
                  aria-label={`Testimonial ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTERACTIVE CHILD DONATION SECTION - Replaces static Mobile App */}
      <ChildInteractiveDonate />

      {/* FLOATING ACTION BAR */}
      <FloatingActionBar />

      {/* FAB */}
      <Link
        href="/bagis"
        className="fixed bottom-24 right-4 sm:right-6 md:bottom-8 md:right-8 bg-secondary text-white p-4 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl hover:scale-110 hover:-translate-y-1 transition-all duration-300 group z-[100]"
      >
        <span className="material-symbols-outlined text-[28px]">volunteer_activism</span>
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 group-hover:ml-2 text-label-md font-medium whitespace-nowrap">
          {t("home.quickDonate")}
        </span>
      </Link>
    </div>
  );
}
