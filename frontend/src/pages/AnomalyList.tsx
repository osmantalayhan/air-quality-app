import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  TablePagination,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';
import { useSnackbar } from '../contexts/SnackbarContext';

interface Anomaly {
  id: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'IN_PROGRESS' | 'RESOLVED';
  created_at: string;
}

const severityColors = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'error',
  CRITICAL: 'error',
};

const statusColors = {
  NEW: 'error',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success',
};

const AnomalyList = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { showMessage } = useSnackbar();

  useEffect(() => {
    fetchAnomalies();
  }, [page, rowsPerPage]);

  const fetchAnomalies = async () => {
    try {
      const response = await axios.get('/api/v1/anomalies/', {
        params: {
          skip: page * rowsPerPage,
          limit: rowsPerPage,
          search: searchTerm,
        },
      });
      setAnomalies(response.data);
    } catch (error) {
      showMessage('Anomaliler yüklenirken bir hata oluştu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setPage(0);
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Anomaliler</Typography>
        <TextField
          size="small"
          placeholder="Ara..."
          value={searchTerm}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Başlık</TableCell>
              <TableCell>Önem Derecesi</TableCell>
              <TableCell>Durum</TableCell>
              <TableCell>Oluşturulma Tarihi</TableCell>
              <TableCell>İşlemler</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {anomalies.map((anomaly) => (
              <TableRow key={anomaly.id} hover>
                <TableCell>{anomaly.title}</TableCell>
                <TableCell>
                  <Chip
                    label={anomaly.severity}
                    color={severityColors[anomaly.severity] as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={anomaly.status}
                    color={statusColors[anomaly.status] as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {format(new Date(anomaly.created_at), 'dd.MM.yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/anomalies/${anomaly.id}`)}
                  >
                    <VisibilityIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={-1}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </TableContainer>
    </Box>
  );
};

export default AnomalyList; 