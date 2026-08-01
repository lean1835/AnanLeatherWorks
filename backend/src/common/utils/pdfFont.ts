import fs from 'fs';
import { PDF_FONT_BOLD, PDF_FONT_REGULAR } from '@config/environment';

interface PdfFontFiles {
    regular: string;
    bold: string;
}

interface RegisteredPdfFonts {
    fontRegular: string;
    fontBold: string;
}

const SYSTEM_FONT_CANDIDATES: readonly PdfFontFiles[] = [
    {
        regular: '/usr/share/fonts/dejavu/DejaVuSans.ttf',
        bold: '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf',
    },
    {
        regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    },
    {
        regular: '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
        bold: '/usr/share/fonts/ttf-dejavu/DejaVuSans-Bold.ttf',
    },
    {
        regular: 'C:/Windows/Fonts/segoeui.ttf',
        bold: 'C:/Windows/Fonts/segoeuib.ttf',
    },
    {
        regular: 'C:/Windows/Fonts/arial.ttf',
        bold: 'C:/Windows/Fonts/arialbd.ttf',
    },
];

function isReadableFile(filePath: string): boolean {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return fs.statSync(filePath).isFile();
    } catch {
        return false;
    }
}

function isReadablePair(fonts: PdfFontFiles): boolean {
    return isReadableFile(fonts.regular) && isReadableFile(fonts.bold);
}

export function resolvePdfFontFiles(): PdfFontFiles {
    if (Boolean(PDF_FONT_REGULAR) !== Boolean(PDF_FONT_BOLD)) {
        throw new Error('PDF_FONT_REGULAR and PDF_FONT_BOLD must be configured together.');
    }

    if (PDF_FONT_REGULAR && PDF_FONT_BOLD) {
        const configuredFonts = { regular: PDF_FONT_REGULAR, bold: PDF_FONT_BOLD };
        if (!isReadablePair(configuredFonts)) {
            throw new Error('Configured PDF font files are missing or unreadable.');
        }
        return configuredFonts;
    }

    const systemFonts = SYSTEM_FONT_CANDIDATES.find(isReadablePair);
    if (!systemFonts) {
        throw new Error('No readable Unicode PDF font pair was found. Configure PDF_FONT_REGULAR and PDF_FONT_BOLD.');
    }
    return systemFonts;
}

export function registerPdfFonts(doc: PDFKit.PDFDocument): RegisteredPdfFonts {
    const fonts = resolvePdfFontFiles();
    const fontRegular = 'AnanPdf-Regular';
    const fontBold = 'AnanPdf-Bold';

    doc.registerFont(fontRegular, fonts.regular);
    doc.registerFont(fontBold, fonts.bold);

    return { fontRegular, fontBold };
}
