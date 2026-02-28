const mongoose = require('mongoose');

/**
 * Poster Concept Schema
 * Stores generated concepts with embeddings for semantic matching
 */
const posterConceptSchema = new mongoose.Schema({
    // Link to generation job
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GenerationJob',
        required: true,
        index: true
    },

    // Poster type
    posterType: {
        type: String,
        enum: ['wish', 'cta', 'awareness'],
        required: true,
        index: true
    },

    // Selected concept
    selectedConcept: {
        concept: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        score: {
            type: Number,
            required: true
        },
        embedding: {
            type: [Number],
            required: true
        }
    },

    // Rejected concepts
    rejectedConcepts: [{
        concept: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        score: {
            type: Number,
            required: true
        },
        embedding: {
            type: [Number],
            required: true
        }
    }],

    // Metadata
    metadata: {
        brandDNA: {
            type: String,
            required: true
        },
        totalGenerated: {
            type: Number,
            default: 5
        },
        selectionMethod: {
            type: String,
            enum: ['semantic_matching', 'first_fallback'],
            required: true
        }
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes for performance
posterConceptSchema.index({ jobId: 1, posterType: 1 });
posterConceptSchema.index({ createdAt: -1 });

const PosterConcept = mongoose.model('PosterConcept', posterConceptSchema);

module.exports = PosterConcept;
