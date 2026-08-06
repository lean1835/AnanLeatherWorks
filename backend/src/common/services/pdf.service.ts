import PDFDocument from 'pdfkit';
import type { CustomerGroupedRepairOrder, RepairOrderData } from '@common/interfaces/repairOrder.interface';
import { ICustomer } from '@common/interfaces/customer.interface';
import { storageService } from '@common/services/r2.service';
import { logger } from '@common/utils/logger';
import { registerPdfFonts } from '@common/utils/pdfFont';
import {
    APP_TIMEZONE,
    BUSINESS_HOTLINE,
    BUSINESS_LOCATION,
    BUSINESS_NAME,
    BUSINESS_WEBSITE,
} from '@config/environment';

export function formatVND(amount: number): string {
    if (amount === 0) return '0đ';
    const formatted = new Intl.NumberFormat('vi-VN').format(amount || 0);
    return `${formatted}đ`;
}

export function formatDate(dateStr: Date | string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: APP_TIMEZONE,
    });
}

interface ImageWithNullableBuffer {
    url: string;
    buffer: Buffer | null;
}

interface LoadedImage {
    url: string;
    buffer: Buffer;
}

function hasImageBuffer(image: ImageWithNullableBuffer): image is LoadedImage {
    return image.buffer !== null;
}

async function fetchImageBuffer(img: unknown): Promise<Buffer | null> {
    try {
        return await storageService.getImageBuffer(img);
    } catch (err) {
        logger.error('PDF image load failed:', err);
        return null;
    }
}

async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
            const index = cursor++;
            results[index] = await mapper(items[index], index);
        }
    });
    await Promise.all(workers);
    return results;
}

export async function generateRepairOrderPDF(
    order: RepairOrderData,
    customer: ICustomer,
    tasks: string[],
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        void (async () => {
            try {
                const doc = new PDFDocument({ margin: 0, size: 'A4' });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.on('error', (err) => reject(err));

                // 1. Font setup
                const { fontRegular, fontBold } = registerPdfFonts(doc);

                // Design System Tokens (Matching Screenshot & Atelier Spec)
                const brandDark = '#1C1410';
                const textMain = '#1C1410';
                const goldAccent = '#C9A96E';
                const goldDark = '#8B6F47';
                const textMuted = '#746A64';
                const borderColor = '#DDD5CE';

                // Page Dimensions (A4 width = 595.28pt, height = 841.89pt, Margins = 36pt)
                const pageWidth = 595.28;
                const startX = 36;
                const totalWidth = 523.28; // 595.28 - 72
                const endX = startX + totalWidth; // 559.28pt

                // 2. ACCENT TOP GOLD BAR (Y=0 to 4)
                doc.rect(0, 0, pageWidth, 4).fill(goldAccent);

                // 3. ATELIER HEADER BANNER (Full Bleed X=0 to 595.28pt, Y=4 to 90pt)
                doc.rect(0, 4, pageWidth, 86).fill(brandDark);

                // Left Brand Section
                doc.font(fontBold).fontSize(18).fillColor('#FAFAF8').text(BUSINESS_NAME, startX, 18);
                doc.font(fontBold)
                    .fontSize(8.5)
                    .fillColor(goldAccent)
                    .text('XƯỞNG SỬA CHỮA & CHẾ TÁC ĐỒ DA THỦ CÔNG', startX, 44);
                doc.font(fontRegular)
                    .fontSize(8.5)
                    .fillColor(textMuted)
                    .text(`Hotline / Zalo: ${BUSINESS_HOTLINE}`, startX, 58);

                // Right Document Badge Section
                doc.strokeColor('rgba(201, 169, 110, 0.4)').lineWidth(1).moveTo(340, 20).lineTo(340, 74).stroke();

                const rightMetaX = 350;
                const rightMetaWidth = endX - rightMetaX; // 209.28pt
                doc.font(fontBold)
                    .fontSize(10)
                    .fillColor(goldAccent)
                    .text('PHIẾU SỬA CHỮA ĐỒ DA', rightMetaX, 22, { width: rightMetaWidth, align: 'right' });
                const orderRef =
                    String(order._id || '')
                        .slice(-6)
                        .toUpperCase() || 'PHIEU';
                doc.font(fontBold)
                    .fontSize(11)
                    .fillColor('#FAFAF8')
                    .text(
                        `Mã phiếu: SC-${formatDate(order.receivedAt || new Date()).replace(/\//g, '')}-${orderRef}`,
                        rightMetaX,
                        38,
                        { width: rightMetaWidth, align: 'right' },
                    );
                doc.font(fontRegular)
                    .fontSize(8.5)
                    .fillColor(textMuted)
                    .text(`Ngày lập: ${formatDate(order.receivedAt || new Date())}`, rightMetaX, 56, {
                        width: rightMetaWidth,
                        align: 'right',
                    });

                // Gold Divider Line at Y=90
                doc.strokeColor(goldAccent).lineWidth(1).moveTo(0, 90).lineTo(pageWidth, 90).stroke();

                // 4. SECTION 1: THÔNG TIN GIAO DỊCH (Matching Screenshot Exact Grid)
                let currentY = 106;
                doc.font(fontBold).fontSize(8.5).fillColor(goldAccent).text('THÔNG TIN GIAO DỊCH', startX, currentY);
                doc.strokeColor(borderColor)
                    .lineWidth(1)
                    .moveTo(startX + 120, currentY + 5)
                    .lineTo(endX, currentY + 5)
                    .stroke();

                currentY += 14;
                const metaBoxY = currentY;
                doc.roundedRect(startX, metaBoxY, totalWidth, 70, 4).fill('#FFFFFF').stroke(borderColor);

                // 3-Column Grid inside Transaction Meta Card (Row 1: Y+12, Row 2: Y+42)
                const c1X = startX + 14; // 50pt
                const c2X = startX + 188; // 224pt
                const c3X = startX + 362; // 398pt

                // Row 1: Khách hàng | Số điện thoại | Đơn vị tiếp nhận
                doc.font(fontBold)
                    .fontSize(7.5)
                    .fillColor(textMuted)
                    .text('KHÁCH HÀNG', c1X, metaBoxY + 12);
                doc.font(fontBold)
                    .fontSize(9.5)
                    .fillColor(textMain)
                    .text(customer.fullName || 'Khách lẻ', c1X, metaBoxY + 22);

                doc.font(fontBold)
                    .fontSize(7.5)
                    .fillColor(textMuted)
                    .text('SỐ ĐIỆN THOẠI', c2X, metaBoxY + 12);
                doc.font(fontBold)
                    .fontSize(9.5)
                    .fillColor(textMain)
                    .text(customer.phone || '—', c2X, metaBoxY + 22);

                doc.font(fontBold)
                    .fontSize(7.5)
                    .fillColor(textMuted)
                    .text('ĐƠN VỊ TIẾP NHẬN', c3X, metaBoxY + 12);
                doc.font(fontBold)
                    .fontSize(9.5)
                    .fillColor(textMain)
                    .text(`Xưởng ${BUSINESS_NAME}`, c3X, metaBoxY + 22);

                // Row 2: Ngày tiếp nhận | Ngày hẹn hoàn thành
                doc.font(fontBold)
                    .fontSize(7.5)
                    .fillColor(textMuted)
                    .text('NGÀY TIẾP NHẬN', c1X, metaBoxY + 42);
                doc.font(fontBold)
                    .fontSize(9.5)
                    .fillColor(textMain)
                    .text(formatDate(order.receivedAt || new Date()), c1X, metaBoxY + 52);

                doc.font(fontBold)
                    .fontSize(7.5)
                    .fillColor(textMuted)
                    .text('NGÀY HẸN HOÀN THÀNH', c2X, metaBoxY + 42);
                doc.font(fontBold)
                    .fontSize(9.5)
                    .fillColor(goldDark)
                    .text(formatDate(order.dueAt || new Date()), c2X, metaBoxY + 52);

                currentY = metaBoxY + 86;

                // 5. SECTION 2: DANH SÁCH ĐỒ DA NHẬN SỬA CHỮA & BẢO DƯỠNG
                doc.font(fontBold)
                    .fontSize(8.5)
                    .fillColor('#B68A45')
                    .text('DANH SÁCH ĐỒ DA NHẬN SỬA CHỮA & BẢO DƯỠNG', startX, currentY);
                doc.strokeColor('#DDD5CE')
                    .lineWidth(1)
                    .moveTo(startX + 245, currentY + 5)
                    .lineTo(endX, currentY + 5)
                    .stroke();

                currentY += 24; // Spacious gap below title to table header

                // Table Header Columns: STT (22pt) | TÊN SẢN PHẨM & ẢNH (136pt) | YÊU CẦU SỬA CHỮA (114pt) | PHỤ KIỆN THAY THẾ (100pt) | TỔNG TIỀN (68pt) | GHI CHÚ (83.28pt)
                const headerHeight = 44;
                const headerY = currentY;
                doc.rect(startX, headerY, totalWidth, headerHeight).fill('#F7F4F1');
                doc.strokeColor('#DDD5CE')
                    .lineWidth(1)
                    .moveTo(startX, headerY)
                    .lineTo(endX, headerY)
                    .stroke()
                    .moveTo(startX, headerY + headerHeight)
                    .lineTo(endX, headerY + headerHeight)
                    .stroke();

                const colDividers = [58, 194, 308, 408, 476];
                doc.strokeColor('#E0D8D0').lineWidth(0.8);
                for (const divX of colDividers) {
                    doc.moveTo(divX, headerY)
                        .lineTo(divX, headerY + headerHeight)
                        .stroke();
                }

                doc.font(fontBold).fontSize(8.5).fillColor('#30231E');
                doc.text('STT', 36, headerY + 14, { width: 22, align: 'center' });
                doc.text('SẢN PHẨM', 58, headerY + 14, { width: 136, align: 'center' });
                doc.font(fontBold).fontSize(8.5).fillColor('#30231E');
                doc.text('YÊU CẦU SỬA CHỮA', 194, headerY + 14, { width: 114, align: 'center' });
                doc.text('PHỤ KIỆN THAY THẾ', 308, headerY + 14, { width: 100, align: 'center' });
                doc.text('TỔNG TIỀN', 408, headerY + 14, { width: 58, align: 'right' });
                doc.text('GHI CHÚ', 484, headerY + 14, { width: 75.28 });

                currentY += headerHeight;
                const rawImgs = Array.isArray(order.images) ? order.images : [];
                const orderImages = (
                    await Promise.all(
                        rawImgs.slice(0, 1).map(async (url: string) => ({
                            url,
                            buffer: await storageService.getImageBuffer(url),
                        })),
                    )
                ).filter(hasImageBuffer);

                const uniqueTaskNames: string[] =
                    Array.isArray(tasks) && tasks.length > 0
                        ? Array.from(new Set(tasks.map((t: unknown) => String(t || '').trim()).filter(Boolean)))
                        : [];
                const taskLines = uniqueTaskNames.map((name) => `• ${name}`).join('\n');

                const itemTotal = Number(order.totalAmount) || 0;

                const productNameStr = String(order.productName || '').trim();
                doc.font(fontBold).fontSize(9.5);
                const productNameHeight = productNameStr
                    ? doc.heightOfString(productNameStr, { width: 132, align: 'center' })
                    : 0;

                const taskLineCount = taskLines ? taskLines.split('\n').length : 1;
                const taskHeight = taskLineCount * 15;
                const photoSize = 68;
                const photoX = 92;
                const col2Height = 10 + (productNameHeight > 0 ? productNameHeight + 6 : 0) + photoSize + 10;
                const rowHeight = Math.max(90, col2Height, 20 + taskHeight);

                const statusStr = (order.status || '').toString().trim().toLowerCase();
                let rowBgColor = '#FFFFFF';
                if (statusStr.includes('hoàn thành')) {
                    rowBgColor = '#BFDBFE';
                } else if (statusStr.includes('đã hủy')) {
                    rowBgColor = '#FECACA';
                }

                // Row Background & Clean Elegant Divider Lines (#E8E2DB, 1px)
                doc.rect(startX, currentY, totalWidth, rowHeight).fill(rowBgColor);
                doc.strokeColor('#E8E2DB')
                    .lineWidth(1)
                    .moveTo(startX, currentY)
                    .lineTo(endX, currentY)
                    .stroke()
                    .moveTo(startX, currentY + rowHeight)
                    .lineTo(endX, currentY + rowHeight)
                    .stroke();

                // Inner vertical dividers between columns
                doc.strokeColor('#E8E2DB').lineWidth(0.8);
                for (const divX of colDividers) {
                    doc.moveTo(divX, currentY)
                        .lineTo(divX, currentY + rowHeight)
                        .stroke();
                }

                // Col 1: STT
                const sttY = currentY + (rowHeight - 10) / 2;
                doc.font(fontRegular).fontSize(9.5).fillColor(textMuted);
                doc.text('1', 36, sttY, { width: 22, align: 'center' });

                // Col 2: TÊN SẢN PHẨM (trên) + ẢNH (dưới)
                let col2ContentY = currentY + 10;
                if (productNameStr) {
                    doc.font(fontBold).fontSize(9.5).fillColor('#30231E');
                    doc.text(productNameStr, 60, col2ContentY, { width: 132, align: 'center' });
                    col2ContentY += productNameHeight + 6;
                }

                const photoY = col2ContentY;

                if (orderImages.length > 0 && orderImages[0].buffer) {
                    try {
                        doc.save();
                        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).clip();
                        doc.image(orderImages[0].buffer, photoX, photoY, {
                            cover: [photoSize, photoSize],
                            align: 'center',
                            valign: 'center',
                        });
                        doc.restore();
                        doc.strokeColor('#F59E0B').lineWidth(1.2);
                        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).stroke();
                    } catch (e) {
                        logger.error('Error embedding image in PDF:', e);
                    }
                } else {
                    doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).fill('#F7F4F1');
                    doc.strokeColor('#F59E0B').lineWidth(1.2);
                    doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).stroke();
                    doc.font(fontRegular).fontSize(8).fillColor('#746A64');
                    doc.text('Chưa có\nảnh', photoX, photoY + Math.floor((photoSize - 20) / 2), { width: photoSize, align: 'center' });
                }

                // Col 3: YÊU CẦU SỬA CHỮA (8pt left padding from X=194)
                const taskY = currentY + 10;
                if (taskLines) {
                    doc.font(fontRegular).fontSize(9).fillColor('#30231E');
                    doc.text(taskLines, 202, taskY, { width: 98, lineGap: 3.5 });
                } else {
                    doc.font(fontRegular).fontSize(8.5).fillColor('#746A64');
                    doc.text('—', 202, taskY, { width: 98 });
                }

                // Col 4: PHỤ KIỆN THAY THẾ (8pt left padding from X=308)
                const matY = currentY + 10;
                const replacementList: string[] =
                    Array.isArray(order.replacementMaterials) && order.replacementMaterials.length > 0
                        ? Array.from(
                              new Set(
                                  order.replacementMaterials
                                      .map((material) => String(material || '').trim())
                                      .filter(Boolean),
                              ),
                          )
                        : [];

                if (replacementList.length > 0) {
                    doc.font(fontRegular).fontSize(8.5).fillColor('#30231E');
                    doc.text(replacementList.map((m: string) => `• ${m}`).join('\n'), 316, matY, {
                        width: 84,
                        lineGap: 3,
                    });
                } else {
                    doc.font(fontRegular).fontSize(8.5).fillColor('#746A64');
                    doc.text('—', 316, matY, { width: 84 });
                }

                // Col 5: TỔNG TIỀN (Top Aligned at currentY + 10, ends at 466pt)
                const amountY = currentY + 10;
                const isInProgress = order.status === 'Đang sửa' || (order.status || '').toLowerCase().includes('đang sửa');
                if (isInProgress) {
                    doc.font(fontBold).fontSize(10).fillColor('#30231E');
                    doc.text('0đ', 408, amountY, { width: 58, align: 'right' });
                    doc.font(fontRegular).fontSize(7).fillColor('#746A64');
                    doc.text('(Chưa hoàn thành)', 408, amountY + 13, { width: 68, align: 'center' });
                } else {
                    doc.font(fontBold).fontSize(10).fillColor('#30231E');
                    doc.text(formatVND(itemTotal), 408, amountY, { width: 58, align: 'right' });
                }

                // Col 6: GHI CHÚ (starts at 484pt -> 18pt gap from Col 5)
                const noteY = currentY + 10;
                doc.font(fontRegular).fontSize(8.5).fillColor('#746A64');
                doc.text(order.note || '—', 484, noteY, { width: 75.28 });

                currentY += rowHeight;

                // Total Summary Row ("TỔNG CỘNG:")
                const totalRowHeight = 28;
                if (currentY + totalRowHeight > 760) {
                    doc.addPage();
                    currentY = 36;
                }

                doc.rect(startX, currentY, totalWidth, totalRowHeight).fill('#F7F4F1');

                doc.strokeColor('#DDD5CE')
                    .lineWidth(1)
                    .moveTo(startX, currentY)
                    .lineTo(endX, currentY)
                    .stroke()
                    .moveTo(startX, currentY + totalRowHeight)
                    .lineTo(endX, currentY + totalRowHeight)
                    .stroke();

                doc.strokeColor('#E0D8D0').lineWidth(0.8);
                doc.moveTo(408, currentY).lineTo(408, currentY + totalRowHeight).stroke();
                doc.moveTo(476, currentY).lineTo(476, currentY + totalRowHeight).stroke();

                const summaryY = currentY + 9;
                doc.font(fontBold).fontSize(9.5).fillColor('#1C1410');
                doc.text('TỔNG CỘNG:', startX, summaryY, { width: 364, align: 'right' });

                const singleGrandTotal = isInProgress ? 0 : itemTotal;
                doc.font(fontBold).fontSize(10).fillColor('#1C1410');
                doc.text(formatVND(singleGrandTotal), 408, summaryY, { width: 58, align: 'right' });

                currentY += totalRowHeight;

                currentY += 24;

                // 7. SECTION 4: XÁC NHẬN GIAO NHẬN (SIGNATURES AREA)
                if (currentY + 110 > 760) {
                    doc.addPage();
                    currentY = 36;
                }

                doc.font(fontBold).fontSize(8.5).fillColor(goldAccent).text('XÁC NHẬN GIAO NHẬN', startX, currentY);
                doc.strokeColor(borderColor)
                    .lineWidth(1)
                    .moveTo(startX + 118, currentY + 5)
                    .lineTo(endX, currentY + 5)
                    .stroke();

                currentY += 14;
                doc.font(fontRegular)
                    .fontSize(8.5)
                    .fillColor(textMuted)
                    .text(`${BUSINESS_LOCATION}, ngày …… tháng …… năm ……`, startX, currentY, {
                        width: totalWidth,
                        align: 'right',
                    });

                currentY += 18;
                const sigY = currentY;
                doc.font(fontBold).fontSize(8.5).fillColor(brandDark);
                doc.text('KHÁCH HÀNG XÁC NHẬN', startX, sigY, { width: 250, align: 'center' });
                doc.text(`ĐẠI DIỆN ${BUSINESS_NAME}`, startX + 273, sigY, { width: 250, align: 'center' });

                currentY += 12;
                doc.font(fontRegular).fontSize(8).fillColor(textMuted);
                doc.text('(Ký và ghi rõ họ tên)', startX, currentY, { width: 250, align: 'center' });
                doc.text('(Ký, ghi rõ họ tên và đóng dấu nếu có)', startX + 273, currentY, {
                    width: 250,
                    align: 'center',
                });

                currentY += 50;
                doc.font(fontBold).fontSize(9.5).fillColor(textMain);
                doc.text(customer.fullName || 'Khách hàng', startX, currentY, { width: 250, align: 'center' });
                doc.text('Xưởng Chế Tác Đồ Da', startX + 273, currentY, { width: 250, align: 'center' });

                // 8. FOOTER BAR (Full-width gold accent line at page bottom)
                doc.strokeColor(goldAccent).lineWidth(2).moveTo(0, 810).lineTo(pageWidth, 810).stroke();
                doc.font(fontRegular).fontSize(8.5).fillColor(textMuted);
                doc.text(`${BUSINESS_NAME} — Phục hồi & Chế tác đồ da thủ công cao cấp.`, startX, 818);
                doc.text(`Hotline / Zalo: ${BUSINESS_HOTLINE} • ${BUSINESS_WEBSITE}`, rightMetaX, 818, {
                    width: rightMetaWidth,
                    align: 'right',
                });

                doc.end();
            } catch (err) {
                reject(err);
            }
        })();
    });
}

export async function generateCustomerGroupPDF(
    customer: ICustomer,
    ordersWithDetails: CustomerGroupedRepairOrder[],
    _month?: number,
    _year?: number,
): Promise<Buffer> {
    const activeOrders = ordersWithDetails.filter(
        (item) => item.status !== 'Đã thanh toán' && (item.status as string) !== 'Đã hủy',
    );
    const ordersWithImages = await mapWithConcurrency(activeOrders, 4, async (item) => {
        const rawImgs = Array.isArray(item.images) ? item.images : [];
        const imagesLoaded = await Promise.all(
            rawImgs.slice(0, 1).map(async (img) => {
                const buffer = await fetchImageBuffer(img);
                return { url: img, buffer };
            }),
        );

        return {
            ...item,
            imagesLoaded: imagesLoaded.filter(hasImageBuffer),
        };
    });

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 0, size: 'A4' });
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', (err) => reject(err));

            const { fontRegular, fontBold } = registerPdfFonts(doc);

            const brandDark = '#1C1410';
            const textMain = '#1C1410';
            const goldAccent = '#C9A96E';
            const goldDark = '#8B6F47';
            const textMuted = '#746A64';
            const borderColor = '#DDD5CE';

            const pageWidth = 595.28;
            const startX = 36;
            const totalWidth = 523.28;
            const endX = startX + totalWidth;

            doc.rect(0, 0, pageWidth, 4).fill(goldAccent);
            doc.rect(0, 4, pageWidth, 86).fill(brandDark);

            doc.font(fontBold).fontSize(18).fillColor('#FAFAF8').text(BUSINESS_NAME, startX, 18);
            doc.font(fontBold)
                .fontSize(8.5)
                .fillColor(goldAccent)
                .text('XƯỞNG SỬA CHỮA & CHẾ TÁC ĐỒ DA THỦ CÔNG', startX, 44);
            doc.font(fontRegular)
                .fontSize(8.5)
                .fillColor(textMuted)
                .text(`Hotline / Zalo: ${BUSINESS_HOTLINE}`, startX, 58);

            doc.strokeColor('rgba(201, 169, 110, 0.4)').lineWidth(1).moveTo(340, 20).lineTo(340, 74).stroke();

            const rightMetaX = 350;
            const rightMetaWidth = endX - rightMetaX;
            const customerRef =
                String(customer._id || '')
                    .slice(-6)
                    .toUpperCase() || 'KHACH';
            const docCodeStr = `SC-${formatDate(new Date()).replace(/\//g, '')}-${customerRef}`;

            doc.font(fontBold)
                .fontSize(10)
                .fillColor(goldAccent)
                .text('PHIẾU SỬA CHỮA TỔNG HỢP', rightMetaX, 22, { width: rightMetaWidth, align: 'right' });
            doc.font(fontBold)
                .fontSize(11)
                .fillColor('#FAFAF8')
                .text(`Mã phiếu: ${docCodeStr}`, rightMetaX, 38, { width: rightMetaWidth, align: 'right' });
            doc.font(fontRegular)
                .fontSize(8.5)
                .fillColor(textMuted)
                .text(`Ngày lập: ${formatDate(new Date())}`, rightMetaX, 56, { width: rightMetaWidth, align: 'right' });

            doc.strokeColor(goldAccent).lineWidth(1).moveTo(0, 90).lineTo(pageWidth, 90).stroke();

            let currentY = 106;
            doc.font(fontBold).fontSize(8.5).fillColor(goldAccent).text('THÔNG TIN GIAO DỊCH', startX, currentY);
            doc.strokeColor(borderColor)
                .lineWidth(1)
                .moveTo(startX + 120, currentY + 5)
                .lineTo(endX, currentY + 5)
                .stroke();

            currentY += 14;
            const metaBoxY = currentY;
            doc.roundedRect(startX, metaBoxY, totalWidth, 70, 4).fill('#FFFFFF').stroke(borderColor);

            const c1X = startX + 14;
            const c2X = startX + 188;
            const c3X = startX + 362;

            const minReceivedAt = ordersWithImages.reduce((earliest, item) => {
                const d = item.receivedAt || item.createdAt;
                if (!d) return earliest;
                return !earliest || new Date(d) < new Date(earliest) ? d : earliest;
            }, ordersWithImages[0]?.receivedAt || ordersWithImages[0]?.createdAt);

            const maxDueAt = ordersWithImages.reduce((latest, item) => {
                if (!item.dueAt) return latest;
                return !latest || new Date(item.dueAt) > new Date(latest) ? item.dueAt : latest;
            }, ordersWithImages[0]?.dueAt);

            // Row 1: Khách hàng | Số điện thoại | Đơn vị tiếp nhận
            doc.font(fontBold)
                .fontSize(7.5)
                .fillColor(textMuted)
                .text('KHÁCH HÀNG', c1X, metaBoxY + 12);
            doc.font(fontBold)
                .fontSize(9.5)
                .fillColor(textMain)
                .text(customer.fullName || 'Khách lẻ', c1X, metaBoxY + 22);

            doc.font(fontBold)
                .fontSize(7.5)
                .fillColor(textMuted)
                .text('SỐ ĐIỆN THOẠI', c2X, metaBoxY + 12);
            doc.font(fontBold)
                .fontSize(9.5)
                .fillColor(textMain)
                .text(customer.phone || '—', c2X, metaBoxY + 22);

            doc.font(fontBold)
                .fontSize(7.5)
                .fillColor(textMuted)
                .text('ĐƠN VỊ TIẾP NHẬN', c3X, metaBoxY + 12);
            doc.font(fontBold)
                .fontSize(9.5)
                .fillColor(textMain)
                .text(`Xưởng ${BUSINESS_NAME}`, c3X, metaBoxY + 22);

            // Row 2: Ngày tiếp nhận | Ngày hẹn hoàn thành
            doc.font(fontBold)
                .fontSize(7.5)
                .fillColor(textMuted)
                .text('NGÀY TIẾP NHẬN', c1X, metaBoxY + 42);
            doc.font(fontBold)
                .fontSize(9.5)
                .fillColor(textMain)
                .text(formatDate(minReceivedAt || new Date()), c1X, metaBoxY + 52);

            doc.font(fontBold)
                .fontSize(7.5)
                .fillColor(textMuted)
                .text('NGÀY HẸN HOÀN THÀNH', c2X, metaBoxY + 42);
            doc.font(fontBold)
                .fontSize(9.5)
                .fillColor(goldDark)
                .text(formatDate(maxDueAt || new Date()), c2X, metaBoxY + 52);

            currentY = metaBoxY + 86;

            doc.font(fontBold)
                .fontSize(8.5)
                .fillColor('#B68A45')
                .text('DANH SÁCH ĐỒ DA NHẬN SỬA CHỮA & BẢO DƯỠNG', startX, currentY);
            doc.strokeColor('#DDD5CE')
                .lineWidth(1)
                .moveTo(startX + 245, currentY + 5)
                .lineTo(endX, currentY + 5)
                .stroke();

            currentY += 24; // Spacious gap below title to table header

            // Table Header Columns: STT (22pt) | TÊN SẢN PHẨM & ẢNH (136pt) | YÊU CẦU SỬA CHỮA (114pt) | PHỤ KIỆN THAY THẾ (100pt) | TỔNG TIỀN (68pt) | GHI CHÚ (83.28pt)
            const headerHeight = 44;
            const headerY = currentY;
            doc.rect(startX, headerY, totalWidth, headerHeight).fill('#F7F4F1');
            doc.strokeColor('#DDD5CE')
                .lineWidth(1)
                .moveTo(startX, headerY)
                .lineTo(endX, headerY)
                .stroke()
                .moveTo(startX, headerY + headerHeight)
                .lineTo(endX, headerY + headerHeight)
                .stroke();

            const groupColDividers = [58, 194, 308, 408, 476];
            doc.strokeColor('#E0D8D0').lineWidth(0.8);
            for (const divX of groupColDividers) {
                doc.moveTo(divX, headerY)
                    .lineTo(divX, headerY + headerHeight)
                    .stroke();
            }

            doc.font(fontBold).fontSize(8.5).fillColor('#30231E');
            doc.text('STT', 36, headerY + 14, { width: 22, align: 'center' });
            doc.text('SẢN PHẨM', 58, headerY + 14, { width: 136, align: 'center' });
            doc.font(fontBold).fontSize(8.5).fillColor('#30231E');
            doc.text('YÊU CẦU SỬA CHỮA', 194, headerY + 14, { width: 114, align: 'center' });
            doc.text('PHỤ KIỆN THAY THẾ', 308, headerY + 14, { width: 100, align: 'center' });
            doc.text('TỔNG TIỀN', 408, headerY + 14, { width: 58, align: 'right' });
            doc.text('GHI CHÚ', 484, headerY + 14, { width: 75.28 });

            currentY += headerHeight;

            ordersWithImages.forEach((order, idx) => {
                const tasks = order.tasks || [];
                const itemTotal = Number(order.totalAmount) || 0;

                const imagesLoaded = (order as unknown as Record<string, unknown>).imagesLoaded as Array<{ url: string; buffer: Buffer }> || [];
                const uniqueTaskNames: string[] =
                    Array.isArray(tasks) && tasks.length > 0
                        ? Array.from(new Set(tasks.map((task) => String(task || '').trim()).filter(Boolean)))
                        : [];
                const taskLines = uniqueTaskNames.map((name) => `• ${name}`).join('\n');

                const productNameStr = String(order.productName || '').trim();
                doc.font(fontBold).fontSize(9.5);
                const productNameHeight = productNameStr
                    ? doc.heightOfString(productNameStr, { width: 132, align: 'center' })
                    : 0;

                const taskLineCount = taskLines ? taskLines.split('\n').length : 1;
                const taskHeight = taskLineCount * 15;
                const photoSize = 68;
                const photoX = 92;
                const col2Height = 10 + (productNameHeight > 0 ? productNameHeight + 6 : 0) + photoSize + 10;
                const rowHeight = Math.max(90, col2Height, 20 + taskHeight);

                if (currentY + rowHeight > 760) {
                    doc.addPage();
                    currentY = 36;
                }
                const statusStr = (order.status || '').toString().trim().toLowerCase();
                let rowBg = '#FFFFFF';
                if (statusStr.includes('hoàn thành')) {
                    rowBg = '#BFDBFE';
                } else if (statusStr.includes('đã hủy')) {
                    rowBg = '#FECACA';
                }
                doc.rect(startX, currentY, totalWidth, rowHeight).fill(rowBg);
                doc.strokeColor('#E8E2DB')
                    .lineWidth(1)
                    .moveTo(startX, currentY)
                    .lineTo(endX, currentY)
                    .stroke()
                    .moveTo(startX, currentY + rowHeight)
                    .lineTo(endX, currentY + rowHeight)
                    .stroke();

                doc.strokeColor('#E8E2DB').lineWidth(0.8);
                for (const divX of groupColDividers) {
                    doc.moveTo(divX, currentY)
                        .lineTo(divX, currentY + rowHeight)
                        .stroke();
                }

                // Col 1: STT
                const sttY = currentY + (rowHeight - 10) / 2;
                doc.font(fontRegular).fontSize(9.5).fillColor(textMuted);
                doc.text(`${idx + 1}`, 36, sttY, { width: 22, align: 'center' });

                // Col 2: TÊN SẢN PHẨM (trên) + ẢNH (dưới)
                let col2ContentY = currentY + 10;
                if (productNameStr) {
                    doc.font(fontBold).fontSize(9.5).fillColor('#30231E');
                    doc.text(productNameStr, 60, col2ContentY, { width: 132, align: 'center' });
                    col2ContentY += productNameHeight + 6;
                }

                const photoY = col2ContentY;

                if (imagesLoaded.length > 0 && imagesLoaded[0].buffer) {
                    try {
                        doc.save();
                        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).clip();
                        doc.image(imagesLoaded[0].buffer, photoX, photoY, {
                            cover: [photoSize, photoSize],
                            align: 'center',
                            valign: 'center',
                        });
                        doc.restore();
                        doc.strokeColor('#F59E0B').lineWidth(1.2);
                        doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).stroke();
                    } catch (e) {
                        logger.error('Error embedding group image in PDF:', e);
                    }
                } else {
                    doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).fill('#F7F4F1');
                    doc.strokeColor('#F59E0B').lineWidth(1.2);
                    doc.roundedRect(photoX, photoY, photoSize, photoSize, 6).stroke();
                    doc.font(fontRegular).fontSize(8).fillColor('#746A64');
                    doc.text('Chưa có\nảnh', photoX, photoY + Math.floor((photoSize - 20) / 2), { width: photoSize, align: 'center' });
                }

                // Col 3: YÊU CẦU SỬA CHỮA (8pt left padding from X=194)
                const taskY = currentY + 10;
                if (taskLines) {
                    doc.font(fontRegular).fontSize(9).fillColor('#30231E');
                    doc.text(taskLines, 202, taskY, { width: 98, lineGap: 3.5 });
                } else {
                    doc.font(fontRegular).fontSize(8.5).fillColor('#746A64');
                    doc.text('—', 202, taskY, { width: 98 });
                }

                // Col 4: PHỤ KIỆN THAY THẾ (8pt left padding from X=308)
                const matY = currentY + 10;
                const replacementList: string[] =
                    Array.isArray(order.replacementMaterials) && order.replacementMaterials.length > 0
                        ? Array.from(
                              new Set(
                                  order.replacementMaterials
                                      .map((material) => String(material || '').trim())
                                      .filter(Boolean),
                              ),
                          )
                        : [];

                if (replacementList.length > 0) {
                    doc.font(fontRegular).fontSize(8.5).fillColor('#30231E');
                    doc.text(replacementList.map((m: string) => `• ${m}`).join('\n'), 316, matY, {
                        width: 84,
                        lineGap: 3,
                    });
                } else {
                    doc.font(fontRegular).fontSize(8.5).fillColor('#746A64');
                    doc.text('—', 316, matY, { width: 84 });
                }

                // Col 5: TỔNG TIỀN (Top Aligned at currentY + 10, ends at 466pt)
                const amountY = currentY + 10;
                const isItemInProgress = order.status === 'Đang sửa' || (order.status || '').toLowerCase().includes('đang sửa');
                if (isItemInProgress) {
                    doc.font(fontBold).fontSize(10).fillColor('#30231E');
                    doc.text('0đ', 408, amountY, { width: 58, align: 'right' });
                    doc.font(fontRegular).fontSize(7).fillColor('#746A64');
                    doc.text('(Chưa hoàn thành)', 408, amountY + 13, { width: 68, align: 'center' });
                } else {
                    doc.font(fontBold).fontSize(10).fillColor('#30231E');
                    doc.text(formatVND(itemTotal), 408, amountY, { width: 58, align: 'right' });
                }

                // Col 6: GHI CHÚ (starts at 484pt -> 18pt gap from Col 5)
                const noteY = currentY + 10;
                doc.font(fontRegular).fontSize(8.5).fillColor('#746A64');
                doc.text(order.note || '—', 484, noteY, { width: 75.28 });

                currentY += rowHeight;
            });

            // Total Summary Row ("TỔNG CỘNG:")
            const grandTotal = ordersWithImages.reduce((sum, item) => {
                const isItemInProgress = item.status === 'Đang sửa' || (item.status || '').toLowerCase().includes('đang sửa');
                return sum + (isItemInProgress ? 0 : Number(item.totalAmount) || 0);
            }, 0);

            const totalRowHeight = 28;
            if (currentY + totalRowHeight > 760) {
                doc.addPage();
                currentY = 36;
            }

            doc.rect(startX, currentY, totalWidth, totalRowHeight).fill('#F7F4F1');

            doc.strokeColor('#DDD5CE')
                .lineWidth(1)
                .moveTo(startX, currentY)
                .lineTo(endX, currentY)
                .stroke()
                .moveTo(startX, currentY + totalRowHeight)
                .lineTo(endX, currentY + totalRowHeight)
                .stroke();
            const summaryY = currentY + 9;
            doc.font(fontBold).fontSize(9.5).fillColor('#1C1410');
            doc.text('TỔNG CỘNG:', startX, summaryY, { width: 364, align: 'right' });

            doc.font(fontBold).fontSize(10).fillColor('#1C1410');
            doc.text(formatVND(grandTotal), 408, summaryY, { width: 58, align: 'right' });

            currentY += totalRowHeight;

            currentY += 24;
            if (currentY + 110 > 760) {
                doc.addPage();
                currentY = 36;
            }
            doc.font(fontBold).fontSize(8.5).fillColor(goldAccent).text('XÁC NHẬN GIAO NHẬN', startX, currentY);
            doc.strokeColor(borderColor)
                .lineWidth(1)
                .moveTo(startX + 118, currentY + 5)
                .lineTo(endX, currentY + 5)
                .stroke();

            currentY += 14;
            doc.font(fontRegular)
                .fontSize(8.5)
                .fillColor(textMuted)
                .text(`${BUSINESS_LOCATION}, ngày …… tháng …… năm ……`, startX, currentY, {
                    width: totalWidth,
                    align: 'right',
                });

            currentY += 18;
            const sigY = currentY;
            doc.font(fontBold).fontSize(8.5).fillColor(brandDark);
            doc.text('KHÁCH HÀNG XÁC NHẬN', startX, sigY, { width: 250, align: 'center' });
            doc.text(`ĐẠI DIỆN ${BUSINESS_NAME}`, startX + 273, sigY, { width: 250, align: 'center' });

            currentY += 12;
            doc.font(fontRegular).fontSize(8).fillColor(textMuted);
            doc.text('(Ký và ghi rõ họ tên)', startX, currentY, { width: 250, align: 'center' });
            doc.text('(Ký, ghi rõ họ tên và đóng dấu nếu có)', startX + 273, currentY, { width: 250, align: 'center' });

            currentY += 50;
            doc.font(fontBold).fontSize(9.5).fillColor(textMain);
            doc.text(customer.fullName || 'Khách hàng', startX, currentY, { width: 250, align: 'center' });
            doc.text('Xưởng Chế Tác Đồ Da', startX + 273, currentY, { width: 250, align: 'center' });

            // 7. FOOTER BAR (Full-width gold accent line at page bottom)
            doc.strokeColor(goldAccent).lineWidth(2).moveTo(0, 810).lineTo(pageWidth, 810).stroke();
            doc.font(fontRegular).fontSize(8.5).fillColor(textMuted);
            doc.text(`${BUSINESS_NAME} — Phục hồi & Chế tác đồ da thủ công cao cấp.`, startX, 818);
            doc.text(`Hotline / Zalo: ${BUSINESS_HOTLINE}`, 300, 818, { width: 265, align: 'right' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}
