import React, { useState } from 'react';
import { Download, FileText, Table, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function ExportManager({ timeEntries, employees }) {
  const [exportFormat, setExportFormat] = useState('pdf');
  const [isExporting, setIsExporting] = useState(false);

  const formatDuration = (startTime, endTime) => {
    if (!endTime) return '0h';
    const duration = (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60);
    return `${Math.round(duration * 10) / 10}h`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'Inconnu';
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('Rapport de Pointage', 20, 20);
    
    // Date
    doc.setFontSize(12);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 20, 30);
    
    // Table data
    const tableData = timeEntries.map(entry => [
      getEmployeeName(entry.employeeId),
      formatDate(entry.startTime),
      formatTime(entry.startTime),
      entry.endTime ? formatTime(entry.endTime) : 'En cours',
      formatDuration(entry.startTime, entry.endTime),
      entry.breaks ? `${entry.breaks.length} pauses` : 'Aucune'
    ]);

    // Table headers
    const headers = [
      'Employé',
      'Date',
      'Arrivée',
      'Départ',
      'Durée',
      'Pauses'
    ];

    // Add table
    doc.autoTable({
      head: [headers],
      body: tableData,
      startY: 40,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [139, 92, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
    });

    // Summary
    const totalHours = timeEntries.reduce((total, entry) => {
      if (entry.endTime) {
        const duration = (new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60);
        return total + duration;
      }
      return total;
    }, 0);

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Total des heures: ${Math.round(totalHours * 10) / 10}h`, 20, finalY);
    doc.text(`Nombre d'entrées: ${timeEntries.length}`, 20, finalY + 10);

    // Save
    doc.save(`pointage_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportToExcel = () => {
    const worksheetData = timeEntries.map(entry => ({
      'Employé': getEmployeeName(entry.employeeId),
      'Date': formatDate(entry.startTime),
      'Arrivée': formatTime(entry.startTime),
      'Départ': entry.endTime ? formatTime(entry.endTime) : 'En cours',
      'Durée (heures)': entry.endTime ? 
        Math.round((new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60) * 10) / 10 : 0,
      'Nombre de pauses': entry.breaks ? entry.breaks.length : 0,
      'Temps de pause (min)': entry.breaks ? 
        entry.breaks.reduce((total, breakItem) => {
          if (breakItem.endTime) {
            return total + (new Date(breakItem.endTime) - new Date(breakItem.startTime)) / (1000 * 60);
          }
          return total;
        }, 0) : 0,
      'Statut': entry.endTime ? 'Terminé' : 'En cours'
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pointages');

    // Add summary sheet
    const summaryData = employees.map(employee => {
      const employeeEntries = timeEntries.filter(entry => entry.employeeId === employee.id);
      const totalHours = employeeEntries.reduce((total, entry) => {
        if (entry.endTime) {
          const duration = (new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60);
          return total + duration;
        }
        return total;
      }, 0);

      return {
        'Employé': employee.name,
        'Poste': employee.position,
        'Total heures': Math.round(totalHours * 10) / 10,
        'Jours travaillés': new Set(employeeEntries.map(entry => 
          new Date(entry.startTime).toDateString()
        )).size,
        'Moyenne heures/jour': employeeEntries.length > 0 ? 
          Math.round((totalHours / new Set(employeeEntries.map(entry => 
            new Date(entry.startTime).toDateString()
          )).size) * 10) / 10 : 0
      };
    });

    const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Résumé');

    XLSX.writeFile(workbook, `pointage_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToCSV = () => {
    const csvData = timeEntries.map(entry => [
      getEmployeeName(entry.employeeId),
      formatDate(entry.startTime),
      formatTime(entry.startTime),
      entry.endTime ? formatTime(entry.endTime) : 'En cours',
      entry.endTime ? 
        Math.round((new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60) * 10) / 10 : 0,
      entry.breaks ? entry.breaks.length : 0
    ]);

    const headers = ['Employé', 'Date', 'Arrivée', 'Départ', 'Durée (heures)', 'Nombre de pauses'];
    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `pointage_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      switch (exportFormat) {
        case 'pdf':
          exportToPDF();
          break;
        case 'excel':
          exportToExcel();
          break;
        case 'csv':
          exportToCSV();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapport de Pointage</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #8B5CF6; margin: 0; }
            .header p { color: #666; margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #8B5CF6; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary { margin-top: 30px; padding: 20px; background-color: #f0f0f0; }
            @media print { 
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Rapport de Pointage</h1>
            <p>Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Employé</th>
                <th>Date</th>
                <th>Arrivée</th>
                <th>Départ</th>
                <th>Durée</th>
                <th>Pauses</th>
              </tr>
            </thead>
            <tbody>
              ${timeEntries.map(entry => `
                <tr>
                  <td>${getEmployeeName(entry.employeeId)}</td>
                  <td>${formatDate(entry.startTime)}</td>
                  <td>${formatTime(entry.startTime)}</td>
                  <td>${entry.endTime ? formatTime(entry.endTime) : 'En cours'}</td>
                  <td>${formatDuration(entry.startTime, entry.endTime)}</td>
                  <td>${entry.breaks ? `${entry.breaks.length} pauses` : 'Aucune'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <h3>Résumé</h3>
            <p><strong>Total des heures:</strong> ${Math.round(timeEntries.reduce((total, entry) => {
              if (entry.endTime) {
                const duration = (new Date(entry.endTime) - new Date(entry.startTime)) / (1000 * 60 * 60);
                return total + duration;
              }
              return total;
            }, 0) * 10) / 10}h</p>
            <p><strong>Nombre d'entrées:</strong> ${timeEntries.length}</p>
            <p><strong>Employés concernés:</strong> ${new Set(timeEntries.map(entry => entry.employeeId)).size}</p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  return (
    <div className="flex items-center space-x-2">
      <select
        value={exportFormat}
        onChange={(e) => setExportFormat(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
      >
        <option value="pdf">PDF</option>
        <option value="excel">Excel</option>
        <option value="csv">CSV</option>
      </select>
      
      <button
        onClick={handleExport}
        disabled={isExporting || timeEntries.length === 0}
        className="flex items-center space-x-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {isExporting ? (
          <>
            <div className="spinner"></div>
            <span>Export...</span>
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            <span>Exporter</span>
          </>
        )}
      </button>
      
      <button
        onClick={printReport}
        disabled={timeEntries.length === 0}
        className="flex items-center space-x-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        <Printer className="w-4 h-4" />
        <span>Imprimer</span>
      </button>
    </div>
  );
}