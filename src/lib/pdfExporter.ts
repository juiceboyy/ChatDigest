import { jsPDF } from 'jspdf';
import { ChatDigestData } from '../types';

/**
 * Format bytes to a human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Splitting text dynamically to support different line widths for the first line and subsequent lines
 */
function splitTextWithPrefix(doc: any, prefix: string, text: string, firstLineWidth: number, otherLineWidth: number): string[] {
  if (!text || !text.trim()) {
    return [];
  }
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  let isFirstLine = true;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = doc.getTextWidth(testLine);
    const targetWidth = isFirstLine ? firstLineWidth : otherLineWidth;

    if (testWidth > targetWidth) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
        isFirstLine = false;
      } else {
        // Word itself is wider than the target width of the current line, force split it
        lines.push(word);
        currentLine = '';
        isFirstLine = false;
      }
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function exportDigestToPdf(digest: ChatDigestData): void {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  let y = 20;

  // Helper helper to handle page wrap
  const checkPageWrap = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = 20;
      drawHeaderBadge();
    }
  };

  const drawHeaderBadge = () => {
    // Elegant tiny running header
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 135);
    doc.text('CHATDIGEST • COMPREHENSIVE OUTLINE REPORT', margin, 12);
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, 14, pageWidth - margin, 14);
  };

  // Initial Running Header
  drawHeaderBadge();

  // Primary Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(30, 41, 59); // deep slate slate-800
  doc.text('ChatDigest Report', margin, y + 8);
  y += 14;

  // File Details Badge
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 110, 125);
  doc.text(`File Name: ${digest.fileName} (${formatBytes(digest.fileSize)})`, margin, y);
  doc.text(`Analyzed on: ${new Date(digest.parsedAt).toLocaleDateString()}`, margin, y + 5);
  doc.text(`Timeline scope: ${digest.startDateStr} — ${digest.endDateStr}`, margin, y + 10);
  y += 18;

  // Separator Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // 1. Executive Summary Paragraph
  const cleanSummary = digest.summary.replace(/\*\*/g, '');
  const splitSummary = doc.splitTextToSize(cleanSummary, contentWidth);
  checkPageWrap((splitSummary.length * 5) + 15);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Executive Summary', margin, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // slate-600

  doc.text(splitSummary, margin, y);
  y += (splitSummary.length * 5) + 6;

  // 2. Vocabulary Keywords Badges
  checkPageWrap(25);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Top Extracted Topic Keywords:', margin, y);
  y += 5;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42); // slate-900
  
  let keywordLine = digest.keywords.map(k => `#${k}`).join('   ');
  doc.text(keywordLine, margin, y);
  y += 12;

  // 3. Participant Contributions
  checkPageWrap(40);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Participant Contributions', margin, y);
  y += 7;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);

  const contributors = Object.entries(digest.participantCounts)
    .sort((a, b) => b[1] - a[1]);

  contributors.forEach(([name, count]) => {
    checkPageWrap(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`• ${name}`, margin + 2, y);
    doc.setTextColor(100, 116, 139);
    doc.text(`${count} messages`, pageWidth - margin - 35, y);
    y += 5.5;
  });
  y += 6;

  // 4. Key Decisions Column
  checkPageWrap(30);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Key Decisions Reached', margin, y);
  y += 7;

  if (digest.decisions.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('No explicit decisions or consensus markers identified.', margin + 2, y);
    y += 8;
  } else {
    digest.decisions.forEach((dec) => {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      const textToDraw = doc.splitTextToSize(dec.text, contentWidth - 10);
      
      const textLineHeight = 4;
      const boxHeight = 14 + (textToDraw.length - 1) * textLineHeight;
      
      checkPageWrap(boxHeight + 6);
      
      // Draw minimal decision card box
      doc.setDrawColor(241, 245, 249);
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 4, contentWidth, boxHeight, 'FD');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text(`${dec.sender} [${dec.dateStr}]:`, margin + 3, y + 1);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      
      doc.text(textToDraw, margin + 3, y + 6);
      y += boxHeight + 4;
    });
  }
  y += 2;

  // 5. Action Items Table
  checkPageWrap(30);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Assigned Action Item Tracker', margin, y);
  y += 7;

  if (digest.actionItems.length === 0) {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('No explicit action assignments identified.', margin + 2, y);
    y += 8;
  } else {
    digest.actionItems.forEach((act) => {
      const senderText = `[${act.sender}] `;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const senderWidth = doc.getTextWidth(senderText);

      let startTextInline = true;
      let firstLineWidth = contentWidth - 8 - senderWidth;
      if (firstLineWidth < 30) {
        startTextInline = false;
        firstLineWidth = contentWidth - 12;
      }
      const otherLineWidth = contentWidth - 12;

      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const lines = splitTextWithPrefix(doc, senderText, act.text, firstLineWidth, otherLineWidth);

      // Calculate dynamic space block height
      const lineSpacing = 4.5;
      const initialHeight = startTextInline ? 0 : lineSpacing;
      const neededHeight = (lines.length * lineSpacing) + initialHeight + 2.5;
      checkPageWrap(neededHeight);

      // Render simple checkbox simulation
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.4);
      doc.rect(margin + 2, y - 3, 3.5, 3.5); // Checkbox box
      
      if (act.completed) {
        // Draw cross lines for checked
        doc.line(margin + 2, y - 3, margin + 5.5, y + 0.5);
        doc.line(margin + 5.5, y - 3, margin + 2, y + 0.5);
      }

      // Draw bold sender prefix
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(senderText, margin + 8, y);

      let currentY = y;
      if (!startTextInline) {
        currentY += lineSpacing;
      }

      // Draw action text lines
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      lines.forEach((lineText, idx) => {
        const lineX = (idx === 0 && startTextInline) ? (margin + 8 + senderWidth) : (margin + 12);
        const lineY = currentY + (idx * lineSpacing);
        doc.text(lineText, lineX, lineY);
      });

      // Advance y search position by the calculated block height
      y = currentY + (lines.length * lineSpacing) + 3;
    });
  }

  // Footer Signature
  checkPageWrap(20);
  y = pageHeight - 15;
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Report compiled completely client-side. ChatDigest protects your conversations.', margin, y);

  // Trigger download
  doc.save(`ChatDigest_${digest.fileName.split('.')[0] || 'Report'}.pdf`);
}

export function exportPlaybookToPdf(digest: ChatDigestData): void {
  if (!digest.playbook) return;

  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  let y = 20;

  // Helper helper to handle page wrap
  const checkPageWrap = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = 20;
      drawHeaderBadge();
    }
  };

  const drawHeaderBadge = () => {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 135);
    doc.text('CHATDIGEST • PROJECT OPERATIONAL PLAYBOOK', margin, 12);
    doc.setDrawColor(220, 225, 230);
    doc.setLineWidth(0.2);
    doc.line(margin, 14, pageWidth - margin, 14);
  };

  // Initial Running Header
  drawHeaderBadge();

  // Primary Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text('Project Operational Playbook', margin, y + 8);
  y += 14;

  // Subtitle/Metadata Badge
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 110, 125);
  doc.text(`Source Chat: ${digest.fileName} (${formatBytes(digest.fileSize)})`, margin, y);
  doc.text(`Compiled on: ${new Date(digest.playbook.generatedAt || digest.parsedAt).toLocaleDateString()}`, margin, y + 5);
  doc.text(`Timeline scope: ${digest.startDateStr} — ${digest.endDateStr}`, margin, y + 10);
  y += 18;

  // Separator Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Playbook Overview
  if (digest.playbook.overview) {
    const cleanOverview = digest.playbook.overview.replace(/\*\*/g, '');
    const splitOverview = doc.splitTextToSize(cleanOverview, contentWidth);
    checkPageWrap((splitOverview.length * 5) + 15);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('Strategic Blueprint Overview', margin, y);
    y += 6;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(splitOverview, margin, y);
    y += (splitOverview.length * 5) + 10;
  }

  // Playbook Chapters
  const plays = digest.playbook.plays || [];
  if (plays.length === 0) {
    checkPageWrap(15);
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('No operational plays defined.', margin, y);
    y += 8;
  } else {
    plays.forEach((play, index) => {
      // Conservative wrap check for the play title first
      checkPageWrap(35);

      // Play Chapter Header
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(79, 70, 229); // indigo-600
      const categoryText = play.category ? `[${play.category.toUpperCase()}] ` : '';
      doc.text(`${index + 1}. ${categoryText}${play.title}`, margin, y);
      y += 6;

      // Play Description / Rationale
      if (play.description) {
        const cleanDesc = play.description.replace(/\*\*/g, '');
        const splitDesc = doc.splitTextToSize(cleanDesc, contentWidth - 10);
        const descHeight = (splitDesc.length * 4.5) + 6;
        
        checkPageWrap(descHeight);

        // Draw left accent line
        doc.setDrawColor(99, 102, 241); // Indigo border
        doc.setLineWidth(0.6);
        doc.line(margin + 2, y - 2, margin + 2, y + descHeight - 6);

        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105); // slate-600
        
        doc.text(splitDesc, margin + 6, y + 2);
        y += descHeight;
      }

      // Execution Steps Checkpoints
      if (play.steps && play.steps.length > 0) {
        checkPageWrap(15);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59); // slate-800
        doc.text('Sequence Execution Steps Checkpoints', margin, y);
        y += 5.5;

        play.steps.forEach((step, sidx) => {
          const stepText = step.replace(/\*\*/g, '');
          const stepLines = doc.splitTextToSize(stepText, contentWidth - 10);
          const stepHeight = (stepLines.length * 4.5) + 2.5;

          checkPageWrap(stepHeight);

          // Render step number
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(79, 70, 229);
          doc.text(`${sidx + 1}`, margin + 2, y + 1);

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(51, 65, 85);
          doc.text(stepLines, margin + 8, y + 1);
          y += stepHeight;
        });
        y += 3;
      }

      // Strategic Advice / Tips
      if (play.tips && play.tips.length > 0) {
        checkPageWrap(15);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text('Strategic Architecture Runbook Advice', margin, y);
        y += 5.5;

        play.tips.forEach((tip) => {
          const tipText = tip.replace(/\*\*/g, '');
          const tipLines = doc.splitTextToSize(tipText, contentWidth - 14);
          const tipHeight = (tipLines.length * 4.5) + 6;

          checkPageWrap(tipHeight);

          // Draw a soft background box for the tip
          doc.setDrawColor(241, 245, 249);
          doc.setFillColor(248, 250, 252);
          doc.rect(margin + 2, y - 2, contentWidth - 4, tipHeight - 2, 'FD');

          // Draw a bullet symbol
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(245, 158, 11); // Amber for sparkles/tips
          doc.text('•', margin + 5, y + 2.5);

          // Draw tip text
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105);
          doc.text(tipLines, margin + 9, y + 2.5);
          y += tipHeight;
        });
        y += 3;
      }

      // Separator between plays
      if (index < plays.length - 1) {
        checkPageWrap(10);
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
      }
    });
  }

  // Footer Signature
  checkPageWrap(20);
  y = pageHeight - 15;
  doc.setFont('Helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Playbook compiled completely client-side. ChatDigest protects your conversations.', margin, y);

  // Trigger download
  const safeTitle = digest.fileName.split('.')[0] || 'Playbook';
  doc.save(`Operational_Playbook_${safeTitle}.pdf`);
}
