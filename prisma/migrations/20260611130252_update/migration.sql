-- CreateTable
CREATE TABLE "visual_dna" (
    "id" TEXT NOT NULL,
    "brand_entity_id" TEXT NOT NULL,
    "visual_style" VARCHAR(128),
    "visual_maturity" VARCHAR(128),
    "design_complexity" VARCHAR(64),
    "primary_color" VARCHAR(32),
    "secondary_color" VARCHAR(32),
    "accent_color" VARCHAR(32),
    "background_color" VARCHAR(32),
    "heading_font" VARCHAR(255),
    "body_font" VARCHAR(255),
    "typography_personality" VARCHAR(128),
    "whitespace_level" VARCHAR(64),
    "content_density" VARCHAR(64),
    "alignment_style" VARCHAR(128),
    "corner_radius_style" VARCHAR(64),
    "shadow_style" VARCHAR(64),
    "preferred_visual_motif" VARCHAR(128),
    "visual_emotion" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "visual_dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_dna" (
    "id" TEXT NOT NULL,
    "brand_entity_id" TEXT NOT NULL,
    "tone" VARCHAR(128),
    "voice" VARCHAR(128),
    "brand_personality" VARCHAR(128),
    "emotional_intensity" VARCHAR(64),
    "headline_style" VARCHAR(128),
    "cta_style" VARCHAR(128),
    "urgency_level" VARCHAR(64),
    "social_proof_usage" VARCHAR(64),
    "primary_messaging_theme" TEXT,
    "secondary_messaging_theme" TEXT,
    "avoided_messaging_theme" TEXT,
    "reading_level" VARCHAR(64),
    "avg_sentence_length" INTEGER,
    "paragraph_density" VARCHAR(64),
    "active_voice_percentage" INTEGER,
    "positioning_statement" TEXT,
    "value_proposition_style" VARCHAR(128),
    "differentiation_strategy" VARCHAR(128),
    "intro_pattern" VARCHAR(128),
    "storytelling_pattern" VARCHAR(128),
    "conclusion_pattern" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "communication_dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_dna" (
    "id" TEXT NOT NULL,
    "brand_entity_id" TEXT NOT NULL,
    "primary_persona" VARCHAR(255),
    "secondary_persona" VARCHAR(255),
    "industry_focus" VARCHAR(255),
    "technical_level" VARCHAR(64),
    "domain_knowledge_level" VARCHAR(64),
    "audience_pain_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience_motivations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience_objections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audience_dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_dna" (
    "id" TEXT NOT NULL,
    "brand_entity_id" TEXT NOT NULL,
    "banned_absolute_claims" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "banned_comparative_claims" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_claims" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "banned_words" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowed_words" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fear_based_marketing_allowed" BOOLEAN NOT NULL DEFAULT false,
    "sensational_language_allowed" BOOLEAN NOT NULL DEFAULT false,
    "political_content_allowed" BOOLEAN NOT NULL DEFAULT false,
    "religious_content_allowed" BOOLEAN NOT NULL DEFAULT false,
    "controversial_topics_allowed" BOOLEAN NOT NULL DEFAULT false,
    "source_file_url" VARCHAR(2000),
    "source_file_name" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "compliance_dna_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visual_dna_brand_entity_id_key" ON "visual_dna"("brand_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "communication_dna_brand_entity_id_key" ON "communication_dna"("brand_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "audience_dna_brand_entity_id_key" ON "audience_dna"("brand_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_dna_brand_entity_id_key" ON "compliance_dna"("brand_entity_id");

-- AddForeignKey
ALTER TABLE "visual_dna" ADD CONSTRAINT "visual_dna_brand_entity_id_fkey" FOREIGN KEY ("brand_entity_id") REFERENCES "brand_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_dna" ADD CONSTRAINT "communication_dna_brand_entity_id_fkey" FOREIGN KEY ("brand_entity_id") REFERENCES "brand_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_dna" ADD CONSTRAINT "audience_dna_brand_entity_id_fkey" FOREIGN KEY ("brand_entity_id") REFERENCES "brand_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_dna" ADD CONSTRAINT "compliance_dna_brand_entity_id_fkey" FOREIGN KEY ("brand_entity_id") REFERENCES "brand_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
