//src/pages/Dashboard.tsx              
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, FileText, Send, Eye, RefreshCw, BarChart3, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Import components from centralized index
import { 
  Header, 
  DynamoProjectsView, 
  EmailInputDialog, 
  PDFPreview 
} from '@/components';

// Import AWS services - ALL data access goes through awsDataService
import {
  getCurrentUser,  // This is from awsDataService, not amplify/auth
  checkDocumentAvailability,
  getDownloadUrl,
  generateActaDocument,
  sendApprovalEmail,
  getProjectStats,
} from '@/lib/awsDataService';

// Types
interface Project {
  project_id: string;
  project_name: string;
  plant_let?: string;
  activity?: string;
  comments?: string;
  pm_email?: string;
  status?: string;
}

interface Stats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  projectsByPM: Record<string, number>;
}

export default function Dashboard() {
  // User state
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [userInfo, setUserInfo] = useState<any>(null);
  
  // Project state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectId, setProjectId] = useState('');
  
  // Statistics state
  const [stats, setStats] = useState<Stats>({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    projectsByPM: {}
  });
  
  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [documentStatus, setDocumentStatus] = useState({ pdf: false, docx: false });
  
  // Modal states
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Initialize dashboard
  useEffect(() => {
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    try {
      // Get user from awsDataService (not amplify directly)
      const user = await getCurrentUser();
      setUserEmail(user.email);
      setUserInfo(user);
      
      // Load statistics if available
      try {
        const projectStats = await getProjectStats();
        setStats(projectStats);
      } catch (error) {
        console.log('Stats not available:', error);
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      toast.error('Failed to load user information');
    } finally {
      setLoading(false);
    }
  };

  // Check document availability when project is selected
  useEffect(() => {
    if (selectedProject?.project_id) {
      checkDocuments();
    }
  }, [selectedProject]);

  const checkDocuments = async () => {
    if (!selectedProject) return;
    
    try {
      const status = await checkDocumentAvailability(selectedProject.project_id);
      setDocumentStatus(status);
    } catch (error) {
      console.error('Error checking documents:', error);
      setDocumentStatus({ pdf: false, docx: false });
    }
  };

  // Handle project selection from table
  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setProjectId(project.project_id);
    toast.success(`Selected: ${project.project_name}`);
  };

  // Generate ACTA document - Manual entry
  const handleGenerateActaManual = async () => {
    if (!projectId.trim()) {
      toast.error('Please enter a project ID');
      return;
    }

    setActionLoading(true);
    try {
      await generateActaDocument(projectId, userEmail, userInfo?.isPM ? 'pm' : 'user');
      toast.success('ACTA generation started. You will receive an email when ready.');
      
      // If this was manual entry, try to refresh the table
      if (!selectedProject || selectedProject.project_id !== projectId) {
        // Force refresh of DynamoProjectsView
        window.location.reload();
      }
    } catch (error: any) {
      console.error('Error generating ACTA:', error);
      toast.error(error?.message || 'Failed to generate ACTA');
    } finally {
      setActionLoading(false);
    }
  };

  // Generate ACTA document - From selected project
  const handleGenerateActa = async () => {
    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }

    setActionLoading(true);
    try {
      await generateActaDocument(
        selectedProject.project_id, 
        userEmail, 
        userInfo?.isPM ? 'pm' : 'user'
      );
      toast.success('ACTA generation started. You will receive an email when ready.');
      
      // Check document status after a delay
      setTimeout(checkDocuments, 5000);
    } catch (error: any) {
      console.error('Error generating ACTA:', error);
      toast.error(error?.message || 'Failed to generate ACTA');
    } finally {
      setActionLoading(false);
    }
  };

  // Download document
  const handleDownload = async (format: 'pdf' | 'docx') => {
    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }

    if (format === 'pdf' && !documentStatus.pdf) {
      toast.error('PDF not available. Please generate first.');
      return;
    }

    if (format === 'docx' && !documentStatus.docx) {
      toast.error('DOCX not available. Please generate first.');
      return;
    }

    setActionLoading(true);
    try {
      const url = await getDownloadUrl(selectedProject.project_id, format);
      window.open(url, '_blank');
      toast.success(`Downloading ${format.toUpperCase()}...`);
    } catch (error: any) {
      console.error(`Error downloading ${format}:`, error);
      toast.error(`Failed to download ${format.toUpperCase()}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Preview PDF
  const handlePreview = async () => {
    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }

    if (!documentStatus.pdf) {
      toast.error('PDF not available. Please generate first.');
      return;
    }

    setActionLoading(true);
    try {
      const url = await getDownloadUrl(selectedProject.project_id, 'pdf');
      setPdfPreviewUrl(url);
    } catch (error: any) {
      console.error('Error previewing PDF:', error);
      toast.error('Failed to preview document');
    } finally {
      setActionLoading(false);
    }
  };

  // Send approval email
  const handleSendApproval = async (email: string) => {
    if (!selectedProject) {
      toast.error('Please select a project first');
      return;
    }

    if (!documentStatus.pdf) {
      toast.error('Please generate the document first');
      return;
    }

    setActionLoading(true);
    try {
      await sendApprovalEmail(selectedProject.project_id, email);
      toast.success('Approval email sent successfully!');
      setIsEmailDialogOpen(false);
    } catch (error: any) {
      console.error('Error sending approval email:', error);
      toast.error('Failed to send approval email');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section with Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {userEmail.split('@')[0]}!
          </h1>
          <p className="text-gray-600">
            Manage your Acta documents and projects
          </p>
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Total Projects</p>
                  <p className="text-2xl font-semibold">{stats.totalProjects}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-semibold">
                    {stats.totalProjects - stats.completedProjects}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <RefreshCw className="h-8 w-8 text-purple-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-semibold">{stats.activeProjects}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <div className="flex items-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-semibold">{stats.completedProjects}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Generate ACTA Document Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm p-6 mb-8"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Generate ACTA Document
          </h2>
          <p className="text-gray-600 mb-4">
            Enter a Project ID to generate, preview, or download ACTA documents
          </p>
          
          <div className="flex gap-4">
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Enter project ID (e.g., 1000000064013473)"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <button
              onClick={handleGenerateActaManual}
              disabled={actionLoading || !projectId.trim()}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${actionLoading ? 'animate-spin' : ''}`} />
              Generate ACTA
            </button>
          </div>
          
          {/* Quick Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => handleDownload('pdf')}
              disabled={!selectedProject || !documentStatus.pdf}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            
            <button
              onClick={() => handleDownload('docx')}
              disabled={!selectedProject || !documentStatus.docx}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download DOCX
            </button>
            
            <button
              onClick={handlePreview}
              disabled={!selectedProject || !documentStatus.pdf}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview PDF
            </button>
            
            <button
              onClick={() => setIsEmailDialogOpen(true)}
              disabled={!selectedProject || !documentStatus.pdf}
              className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Approval
            </button>
          </div>
        </motion.div>

        {/* DynamoDB Projects View */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Your Projects
          </h2>
          <DynamoProjectsView
            userEmail={userEmail}
            onProjectSelect={handleProjectSelect}
            selectedProjectId={selectedProject?.project_id}
          />
        </motion.div>
      </div>

      {/* PDF Preview Modal */}
      {pdfPreviewUrl && (
        <PDFPreview
          isOpen={!!pdfPreviewUrl}
          pdfUrl={pdfPreviewUrl}
          fileName={`acta-${selectedProject?.project_id}.pdf`}
          onClose={() => setPdfPreviewUrl(null)}
        />
      )}

      {/* Email Dialog */}
      <EmailInputDialog
        isOpen={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
        onSubmit={handleSendApproval}
        loading={actionLoading}
        title="Send Approval Request"
        description={`Send approval request for: ${selectedProject?.project_name || 'Selected Project'}`}
        placeholder="Enter client email address"
      />
    </div>
  );
}

diegobotero@DIEGOs-MacBook-Pro acta-ui % nano src/App.tsx                          
diegobotero@DIEGOs-MacBook-Pro acta-ui % cat src/App.tsx            
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { skipAuth } from '@/env.variables';
import { useIdleLogout } from '@/hooks/useIdleLogout';
import { useThemedFavicon } from '@/hooks/useThemedFavicon';
import Dashboard from '@/pages/Dashboard';
import Login from '@/pages/Login';

export default function App() {
  useThemedFavicon();
  useIdleLogout(30);

  const [checked, setChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    document.title = 'Ikusi · Acta Platform';
  }, []);

  useEffect(() => {
    const verify = async () => {
      try {
        const localToken = localStorage.getItem('ikusi.jwt');

        if (!localToken) {
          setIsAuthed(false);
          setChecked(true);
          return;
        }

        // This is correct - using Amplify to verify token
        const { tokens } = await fetchAuthSession();
        const token = tokens?.idToken?.toString() ?? '';

        if (token) {
          localStorage.setItem('ikusi.jwt', token);
          setIsAuthed(true);
        } else {
          localStorage.removeItem('ikusi.jwt');
          setIsAuthed(false);
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        localStorage.removeItem('ikusi.jwt');
        setIsAuthed(false);
      } finally {
        setChecked(true);
      }
    };

    if (skipAuth) {
      setIsAuthed(true);
      setChecked(true);
    } else {
      verify();
    }

    const handleStorageChange = () => {
      const token = localStorage.getItem('ikusi.jwt');
      if (!token) setIsAuthed(false);
    };

    const handleAuthSuccess = () => {
      verify();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-success', handleAuthSuccess);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-success', handleAuthSuccess);
    };
  }, []);

  // Loading state while checking auth
  if (!checked) {
    return (
      <ChakraProvider value={defaultSystem}>
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Verifying authentication...</p>
          </div>
        </div>
      </ChakraProvider>
    );
  }

  return (
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <Routes>
          {/* Root redirects to dashboard */}
          <Route
            path="/"
            element={<Navigate to={skipAuth || isAuthed ? '/dashboard' : '/login'} replace />}
          />
          
          {/* Login route */}
          <Route
            path="/login"
            element={skipAuth || isAuthed ? <Navigate to="/dashboard" replace /> : <Login />}
          />
          
          {/* Main Dashboard - UNIFIED view */}
          <Route
            path="/dashboard"
            element={skipAuth || isAuthed ? <Dashboard /> : <Navigate to="/login" replace />}
          />
          
          {/* Profile route (optional) */}
          <Route
            path="/profile"
            element={skipAuth || isAuthed ? <ProfilePage /> : <Navigate to="/login" replace />}
          />

          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#363636', color: '#fff' },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </ChakraProvider>
  );
}

// Simple Profile Page Component
function ProfilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-emerald-50">
      <Header />
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">User Profile</h1>
          <p className="text-gray-600 mb-6">Profile management coming soon</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
diegobotero@DIEGOs-MacBook-Pro acta-ui % 
