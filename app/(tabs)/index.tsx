import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Button, Alert, ActivityIndicator, TouchableOpacity, Modal, TextInput, Animated, Dimensions, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../../context/auth';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Initialize Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

type CartItem = {
  name: string;
  quantity: number;
};

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [activeContainer, setActiveContainer] = useState<{ name: string, barcode_number: string } | null>(null);
  const [stockLevel, setStockLevel] = useState<number | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  const { user, signOut } = useAuth();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [scanLineAnim]);

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-85, 85],
  });

  if (!permission) {
    // Camera permissions still loading
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data, bounds }: { type: string; data: string; bounds: any }) => {
    // 1. AREA RESTRICTION check
    const boxWidth = 280;
    const boxHeight = 180;
    const boxLeft = (SCREEN_WIDTH - boxWidth) / 2;
    const boxTop = (SCREEN_HEIGHT - boxHeight) / 2;
    const boxRight = boxLeft + boxWidth;
    const boxBottom = boxTop + boxHeight;

    const barcodeX = bounds.origin.x;
    const barcodeY = bounds.origin.y;

    if (barcodeX < boxLeft || barcodeX > boxRight || barcodeY < boxTop || barcodeY > boxBottom) {
      return;
    }

    setScanned(true);
    setLoading(true);

    try {
      const { data: container, error: lookupError } = await supabase
        .from('specimen_containers')
        .select('name, barcode_number')
        .eq('barcode_number', data)
        .single();

      if (lookupError || !container) {
        Alert.alert("Unknown Barcode", `Not found: ${data}`, [{ text: "OK", onPress: () => setScanned(false) }]);
        return;
      }

      // 2. Fetch STOCK LEVEL from items table
      const { data: itemData, error: stockError } = await supabase
        .from('items')
        .select('quantity')
        .eq('name', container.name)
        .single();

      setActiveContainer(container);
      setStockLevel(itemData ? itemData.quantity : 0);
      setShowQtyModal(true);

    } catch (error) {
      console.error("Scan Error:", error);
      Alert.alert("Error", "Scan failed.");
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = () => {
    if (!activeContainer) return;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) return;

    if (stockLevel !== null && qty > stockLevel) {
      Alert.alert("Insufficient Stock", `Only ${stockLevel} available for ${activeContainer.name}.`);
      return;
    }

    setCart([...cart, { name: activeContainer.name, quantity: qty }]);
    setShowQtyModal(false);
    setScanned(false);
    setActiveContainer(null);
    setQuantity('1');
    setStockLevel(null);
  };

  const placeOrder = async () => {
    if (cart.length === 0 || !user) return;
    setLoading(true);
    setShowCartModal(false);

    try {
      // Summary for item_name and quantity columns
      const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
      const summaryText = cart.length === 1
        ? cart[0].name
        : `${cart[0].name} + ${cart.length - 1} more items`;

      const orderPayload = {
        item_name: summaryText,
        quantity: totalQty,
        items: cart,
        urgency: "Normal",
        ordered_by: user.full_name,
        ordered_by_id: user.id,
        department: user.department,
        ward: user.ward,
        status: "pending",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('orders').insert([orderPayload]);
      if (error) throw error;

      Alert.alert("Order Placed", `Successfully ordered ${cart.length} items.`, [
        {
          text: "OK", onPress: () => {
            setCart([]);
            setScanned(false);
          }
        }
      ]);

    } catch (error) {
      console.error("Order Error:", error);
      Alert.alert("Error", "Failed to place order.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "upc_e", "code128"],
        }}
      />

      {/* Scanner Overlay Guide */}
      <View style={styles.scannerOverlay}>
        <View style={styles.unfocusedContainer}></View>
        <View style={styles.middleRow}>
          <View style={styles.unfocusedContainer}></View>
          <View style={styles.focusedContainer}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {/* Animated Scanning Line */}
            <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
          </View>
          <View style={styles.unfocusedContainer}></View>
        </View>
        <View style={styles.unfocusedContainer}></View>
      </View>

      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.userText}>{user?.full_name}</Text>
          <Text style={styles.deptText}>{user?.department} - {user?.ward}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Cart Badge */}
      {cart.length > 0 && !scanned && (
        <TouchableOpacity style={styles.cartFloatingBtn} onPress={() => setShowCartModal(true)}>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cart.length}</Text>
          </View>
          <Text style={styles.cartBtnText}>View Cart / Checkout</Text>
        </TouchableOpacity>
      )}

      {/* Quantity Modal */}
      <Modal visible={showQtyModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Quantity</Text>
            <Text style={styles.modalSub}>{activeContainer?.name}</Text>
            {stockLevel !== null && (
              <Text style={[styles.stockText, stockLevel < 10 && styles.lowStock]}>
                Available Stock: {stockLevel}
              </Text>
            )}
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => { setShowQtyModal(false); setScanned(false); }}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={addToCart}>
                <Text style={styles.btnText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cart Modal */}
      <Modal visible={showCartModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Your Cart</Text>
            <ScrollView style={{ width: '100%', maxHeight: 300, marginVertical: 15 }}>
              {cart.map((item, idx) => (
                <View key={idx} style={styles.cartItem}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemQty}>x{item.quantity}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => setShowCartModal(false)}>
                <Text style={styles.btnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.confirmBtn]} onPress={placeOrder}>
                <Text style={styles.btnText}>Place Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute', top: 50, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', padding: 15, borderRadius: 12, zIndex: 5,
  },
  userInfo: { flex: 1 },
  userText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  deptText: { color: '#ccc', fontSize: 14 },
  logoutBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: '#fff', fontWeight: 'bold' },

  scannerOverlay: { ...StyleSheet.absoluteFillObject },
  unfocusedContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  middleRow: { flexDirection: 'row', height: 250 },
  focusedContainer: { width: 280, height: 180, justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: '#007AFF', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 15 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 15 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 15 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 15 },
  scanLine: { width: '90%', height: 2, backgroundColor: '#FF3B30', elevation: 10 },

  cartFloatingBtn: {
    position: 'absolute', bottom: 50, left: 20, right: 20,
    backgroundColor: '#007AFF', padding: 18, borderRadius: 15,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  cartBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  cartBadge: {
    backgroundColor: '#FF3B30', width: 25, height: 25, borderRadius: 12.5,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  cartBadgeText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  modalSub: { fontSize: 16, color: '#666', marginBottom: 5 },
  stockText: { fontSize: 14, color: '#28A745', fontWeight: '600', marginBottom: 15 },
  lowStock: { color: '#FF3B30' },
  input: { width: '100%', height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, textAlign: 'center', fontSize: 20, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 15 },
  btn: { flex: 1, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { backgroundColor: '#8E8E93' },
  confirmBtn: { backgroundColor: '#007AFF' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  cartItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee', width: '100%' },
  cartItemName: { fontSize: 16, fontWeight: '500' },
  cartItemQty: { fontSize: 16, color: '#007AFF' },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
});
