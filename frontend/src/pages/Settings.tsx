import React, { useState, ChangeEvent } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormGroup,
  FormControlLabel,
  TextField,
  Button,
  Grid,
  Divider,
} from '@mui/material';

interface SettingsState {
  emailNotifications: boolean;
  pushNotifications: boolean;
  alertThreshold: string;
  apiKey: string;
  darkMode: boolean;
  autoRefresh: boolean;
  refreshInterval: string;
}

const Settings = () => {
  const [settings, setSettings] = useState<SettingsState>({
    emailNotifications: true,
    pushNotifications: false,
    alertThreshold: '75',
    apiKey: '********',
    darkMode: false,
    autoRefresh: true,
    refreshInterval: '5',
  });

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked } = event.target;
    setSettings(prev => ({
      ...prev,
      [name]: event.target.type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = () => {
    // TODO: Implement settings save functionality
    console.log('Settings saved:', settings);
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          System Settings
        </Typography>
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Notifications
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.emailNotifications}
                    onChange={handleChange}
                    name="emailNotifications"
                  />
                }
                label="Email Notifications"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.pushNotifications}
                    onChange={handleChange}
                    name="pushNotifications"
                  />
                }
                label="Push Notifications"
              />
            </FormGroup>
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Alert Settings
            </Typography>
            <TextField
              label="Alert Threshold (%)"
              type="number"
              name="alertThreshold"
              value={settings.alertThreshold}
              onChange={handleChange}
              fullWidth
              sx={{ mb: 2 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              API Configuration
            </Typography>
            <TextField
              label="API Key"
              type="password"
              name="apiKey"
              value={settings.apiKey}
              onChange={handleChange}
              fullWidth
              sx={{ mb: 2 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Display Settings
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.darkMode}
                    onChange={handleChange}
                    name="darkMode"
                  />
                }
                label="Dark Mode"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoRefresh}
                    onChange={handleChange}
                    name="autoRefresh"
                  />
                }
                label="Auto Refresh"
              />
            </FormGroup>
            <TextField
              label="Refresh Interval (minutes)"
              type="number"
              name="refreshInterval"
              value={settings.refreshInterval}
              onChange={handleChange}
              fullWidth
              sx={{ mt: 2 }}
            />
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              sx={{ mt: 2 }}
            >
              Save Settings
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Settings; 