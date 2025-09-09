import React, { createContext, useContext, ReactNode } from 'react';
import { ManagedAddressRange } from '../types/modbus';

interface AddressRangeContextType {
  ranges: ManagedAddressRange[];
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const AddressRangeContext = createContext<AddressRangeContextType | undefined>(undefined);

interface AddressRangeProviderProps {
  children: ReactNode;
  ranges: ManagedAddressRange[];
}

export const AddressRangeProvider: React.FC<AddressRangeProviderProps> = ({ 
  children, 
  ranges 
}) => {
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <AddressRangeContext.Provider value={{ 
      ranges, 
      refreshTrigger, 
      triggerRefresh 
    }}>
      {children}
    </AddressRangeContext.Provider>
  );
};

export const useAddressRangeContext = () => {
  const context = useContext(AddressRangeContext);
  if (context === undefined) {
    throw new Error('useAddressRangeContext must be used within an AddressRangeProvider');
  }
  return context;
};