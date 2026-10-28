"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
} from "antd";
import {
  ApiOutlined,
  GlobalOutlined,
  ReadOutlined,
  SaveOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import { toast } from "react-toastify";
import { ApiError } from "@/app/types/common/ApiError";
import {
  getSettingsAsync,
  testConnectionAsync,
  readMachineBitsAsync,
  updateSettingsAsync,
  writeMachineBitsAsync,
} from "@/app/services/settings/SettingsService";
import { Machine, MachineStatus } from "@/app/types";
import { getMachinesAsync } from "@/app/services/machine/MachineService";

const { Text } = Typography;

interface SettingsFormValues {
  ipAddress: string;
  port: number;
}

type WriteFormValues = {
  status: MachineStatus;
  part: number;
  partProcess: number;
  processStatus: number;
};

type ReadFormValues = {
  status?: MachineStatus;
  part?: number;
  partProcess?: number;
  processStatus?: number;
};

interface Props {
  active: boolean;
}

const DEFAULT_SETTINGS: SettingsFormValues = {
  ipAddress: "192.168.3.250",
  port: 502,
};

const IPV4_PATTERN =
  /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

export default function SettingsTab({ active }: Props) {
  const [form] = Form.useForm<SettingsFormValues>();
  const [writeForm] = Form.useForm<WriteFormValues>();
  const [readForm] = Form.useForm<ReadFormValues>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  const [loadingMachines, setLoadingMachines] = useState(false);
  const [machineSource, setMachineSource] = useState<Machine[]>([]);
  const [selectedWriteMachine, setSelectedWriteMachine] =
    useState<Machine | null>(null);
  const [selectedReadMachine, setSelectedReadMachine] =
    useState<Machine | null>(null);
  const [submittingWrite, setSubmittingWrite] = useState(false);
  const [submittingRead, setSubmittingRead] = useState(false);

  const fetchMachineSource = useCallback(async () => {
    setLoadingMachines(true);

    try {
      const data = await getMachinesAsync();
      setMachineSource(data);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách máy:", error);
      toast.error("Không thể tải danh sách máy");
    } finally {
      setLoadingMachines(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSettingsAsync();

      form.setFieldValue("ipAddress", data.ipAddress);
      form.setFieldValue("port", data.port);
    } catch (error) {
      console.error("Có lỗi xảy ra khi lấy thông tin settings:", error);

      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        return;
      }

      toast.error("Có lỗi xảy ra khi lấy thông tin settings.");
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    const run = async () => {
      Promise.all([fetchMachineSource(), fetchSettings()]);
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handleSave = async (values: SettingsFormValues) => {
    const request = {
      ipAddress: values.ipAddress,
      port: values.port,
    };

    setSaving(true);

    try {
      await updateSettingsAsync(request);
      toast.success("Lưu cài đặt thành công.");

      const data = await getSettingsAsync();

      console.log(data);
    } catch (error) {
      console.error("Lỗi khi update settings:", error);

      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        return;
      }

      toast.error("Có lỗi xảy ra khi update settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      await testConnectionAsync();
      toast.success("Kết nối thành công.");
    } catch (error) {
      console.error("Kết nối thất bại:", error);

      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        return;
      }

      toast.error("Connect failure.");
    } finally {
      setTestingConnection(false);
    }
  };

  const handleWriteMachineChange = (machineId?: number) => {
    const machine = machineSource.find((item) => item.id === machineId) ?? null;

    setSelectedWriteMachine(machine);
    writeForm.resetFields();
  };

  const handleReadMachineChange = (machineId?: number) => {
    const machine = machineSource.find((item) => item.id === machineId) ?? null;

    setSelectedReadMachine(machine);
    readForm.resetFields();
  };

  const handleSubmitWrite = async (values: WriteFormValues) => {
    if (!selectedWriteMachine) {
      toast.warning("Vui lòng chọn máy");
      return;
    }

    if (selectedWriteMachine.statusBitAddress === null) {
      toast.error("Máy chưa cấu hình Status Bit Address");
      return;
    }

    if (selectedWriteMachine.partBitAddress === null) {
      toast.error("Máy chưa cấu hình Part Bit Address");
      return;
    }

    if (selectedWriteMachine.partProcessBitAddress === null) {
      toast.error("Máy chưa cấu hình Part Process Bit Address");
      return;
    }

    const request = {
      statusBitAddress: selectedWriteMachine.statusBitAddress,
      partBitAddress: selectedWriteMachine.partBitAddress,
      partProcessBitAddress: selectedWriteMachine.partProcessBitAddress,
      processStatusBitAddress: selectedWriteMachine.processStatusBitAddress,
      statusValue: values.status,
      partValue: values.part,
      partProcessValue: values.partProcess,
      processStatusValue: values.processStatus,
    };

    try {
      setSubmittingWrite(true);

      await writeMachineBitsAsync(request);

      toast.success("Gửi lệnh ghi thành công");
    } catch (error) {
      console.error(error);
      toast.error("Gửi lệnh ghi thất bại");
    } finally {
      setSubmittingWrite(false);
    }
  };

  const handleSubmitRead = async () => {
    if (!selectedReadMachine) {
      toast.warning("Vui lòng chọn máy");
      return;
    }

    if (selectedReadMachine.statusBitAddress === null) {
      toast.error("Máy chưa cấu hình Status Bit Address");
      return;
    }

    if (selectedReadMachine.partBitAddress === null) {
      toast.error("Máy chưa cấu hình Part Bit Address");
      return;
    }

    if (selectedReadMachine.partProcessBitAddress === null) {
      toast.error("Máy chưa cấu hình Part Process Bit Address");
      return;
    }

    const request = {
      statusBitAddress: selectedReadMachine.statusBitAddress,
      partBitAddress: selectedReadMachine.partBitAddress,
      partProcessBitAddress: selectedReadMachine.partProcessBitAddress,
      processStatusBitAddress: selectedReadMachine.processStatusBitAddress,
    };

    try {
      setSubmittingRead(true);

      const data = await readMachineBitsAsync(request);

      readForm.setFieldsValue({
        status: data.statusValue,
        part: data.partValue,
        partProcess: data.partProcessValue,
        processStatus: data.processStatusValue,
      });

      toast.success("Đọc dữ liệu thành công");
    } catch (error) {
      console.error(error);

      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
        return;
      }

      toast.error("Đọc dữ liệu thất bại");
    } finally {
      setSubmittingRead(false);
    }
  };

  return (
    <div
      className="d-flex flex-column"
      style={{ height: "calc(100vh - 80px)" }}
    >
      <div className="grow overflow-auto pe-2">
        <div className="card-body">
          <Form<SettingsFormValues>
            form={form}
            layout="vertical"
            initialValues={DEFAULT_SETTINGS}
            disabled={loading}
            onFinish={handleSave}
          >
            <Card
              title={
                <Space>
                  <GlobalOutlined />
                  Thông tin PLC
                </Space>
              }
            >
              <div className="row">
                <div className="col-12 col-lg-6">
                  <Form.Item
                    label="Địa chỉ IP"
                    name="ipAddress"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập địa chỉ IP",
                      },
                      {
                        pattern: IPV4_PATTERN,
                        message: "Địa chỉ IPv4 không hợp lệ",
                      },
                    ]}
                  >
                    <Input
                      prefix={<GlobalOutlined />}
                      placeholder="Ví dụ: 192.168.1.100"
                      maxLength={15}
                    />
                  </Form.Item>
                </div>

                <div className="col-12 col-lg-6">
                  <Form.Item
                    label="Port"
                    name="port"
                    rules={[
                      {
                        required: true,
                        message: "Vui lòng nhập port",
                      },
                      {
                        type: "number",
                        min: 1,
                        max: 65535,
                        message: "Port phải nằm trong khoảng 1 đến 65535",
                      },
                    ]}
                  >
                    <InputNumber
                      className="w-100"
                      min={1}
                      max={65535}
                      precision={0}
                      placeholder="Ví dụ: 5000"
                      prefix={<ApiOutlined />}
                    />
                  </Form.Item>
                </div>
              </div>

              <Divider />
            </Card>

            <div className="d-flex justify-content-end align-items-center gap-2 flex-wrap mt-3">
              <Button
                icon={<WifiOutlined />}
                loading={testingConnection}
                onClick={handleTestConnection}
              >
                Kiểm tra kết nối
              </Button>

              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
              >
                Lưu cài đặt
              </Button>
            </div>
          </Form>


          <div className="mt-4">
            <div className="row g-3">
              <div className="col-12 col-xl-6">
                <Card title="Ghi dữ liệu xuống máy" className="h-100">
                  <Form
                    form={writeForm}
                    layout="vertical"
                    onFinish={handleSubmitWrite}
                    initialValues={{
                      status: MachineStatus.None,
                      part: 0,
                      partProcess: 0,
                      processStatus: 0,
                    }}
                  >
                    <Form.Item label="Máy">
                      <Select
                        allowClear
                        showSearch={{
                          filterOption: (input, option) =>
                            String(option?.code ?? "")
                              .toLocaleLowerCase()
                              .includes(input.trim().toLocaleLowerCase()),
                        }}
                        loading={loadingMachines}
                        placeholder="Chọn máy"
                        value={selectedWriteMachine?.id}
                        options={machineSource.map((machine) => ({
                          value: machine.id,
                          label: `${machine.name} - ${machine.code}`,
                          code: machine.code,
                        }))}
                        onChange={handleWriteMachineChange}
                      />
                    </Form.Item>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(160px, 220px) 1fr",
                        gap: 12,
                        alignItems: "center",
                        marginBottom: 16,
                      }}
                    >
                      <Space orientation="vertical" size={0}>
                        <Text strong>Thanh ghi trạng thái</Text>
                        <Text type="secondary">
                          Địa chỉ:{" "}
                          {selectedWriteMachine?.statusBitAddress ?? "-"}
                        </Text>
                      </Space>

                      <Form.Item
                        name="status"
                        style={{ marginBottom: 0 }}
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng chọn trạng thái",
                          },
                        ]}
                      >
                        <Select
                          placeholder="Chọn trạng thái"
                          disabled={!selectedWriteMachine}
                          options={[
                            { value: MachineStatus.None, label: "None" },
                            { value: MachineStatus.Running, label: "Running" },
                            { value: MachineStatus.Paused, label: "Paused" },
                            { value: MachineStatus.Stopped, label: "Stopped" },
                            { value: MachineStatus.Alarm, label: "Alarm" },
                          ]}
                        />
                      </Form.Item>

                      <Space orientation="vertical" size={0}>
                        <Text strong>Thanh ghi part</Text>
                        <Text type="secondary">
                          Địa chỉ: {selectedWriteMachine?.partBitAddress ?? "-"}
                        </Text>
                      </Space>

                      <Form.Item
                        name="part"
                        style={{ marginBottom: 0 }}
                        rules={[
                          { required: true, message: "Vui lòng nhập Part" },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          precision={0}
                          disabled={!selectedWriteMachine}
                          placeholder="Nhập giá trị Part"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>

                      <Space orientation="vertical" size={0}>
                        <Text strong>Thanh ghi Part Process</Text>
                        <Text type="secondary">
                          Địa chỉ:{" "}
                          {selectedWriteMachine?.partProcessBitAddress ?? "-"}
                        </Text>
                      </Space>

                      <Form.Item
                        name="partProcess"
                        style={{ marginBottom: 0 }}
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập Part Process",
                          },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          precision={0}
                          disabled={!selectedWriteMachine}
                          placeholder="Nhập giá trị Part Process"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>

                      <Space orientation="vertical" size={0}>
                        <Text strong>Thanh ghi trạng thái gửi lệnh</Text>
                        <Text type="secondary">
                          Địa chỉ:{" "}
                          {selectedWriteMachine?.processStatusBitAddress ?? "-"}
                        </Text>
                      </Space>

                      <Form.Item
                        name="processStatus"
                        style={{ marginBottom: 0 }}
                        rules={[
                          {
                            required: true,
                            message: "Vui lòng nhập giá trị",
                          },
                        ]}
                      >
                        <InputNumber
                          min={0}
                          precision={0}
                          disabled={!selectedWriteMachine}
                          placeholder="Nhập giá trị Part Process"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </div>

                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={submittingWrite}
                      disabled={!selectedWriteMachine}
                      block
                    >
                      Gửi lệnh ghi
                    </Button>
                  </Form>
                </Card>
              </div>

              <div className="col-12 col-xl-6">
                <Card title="Đọc dữ liệu từ máy" className="h-100">
                  <Form form={readForm} layout="vertical">
                    <Form.Item label="Máy">
                      <Select
                        allowClear
                        showSearch={{
                          filterOption: (input, option) =>
                            String(option?.code ?? "")
                              .toLocaleLowerCase()
                              .includes(input.trim().toLocaleLowerCase()),
                        }}
                        loading={loadingMachines}
                        placeholder="Chọn máy"
                        value={selectedReadMachine?.id}
                        options={machineSource.map((machine) => ({
                          value: machine.id,
                          label: `${machine.name} - ${machine.code}`,
                          code: machine.code,
                        }))}
                        onChange={handleReadMachineChange}
                      />
                    </Form.Item>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(160px, 220px) 1fr",
                        gap: 12,
                        alignItems: "center",
                        marginBottom: 16,
                      }}
                    >
                      <Space orientation="vertical" size={0}>
                        <Text strong>Thanh ghi trạng thái</Text>
                        <Text type="secondary">
                          Địa chỉ:{" "}
                          {selectedReadMachine?.statusBitAddress ?? "-"}
                        </Text>
                      </Space>

                      <Form.Item name="status" style={{ marginBottom: 0 }}>
                        <Select
                          disabled
                          placeholder="Giá trị trạng thái"
                          options={[
                            { value: MachineStatus.None, label: "None" },
                            { value: MachineStatus.Running, label: "Running" },
                            { value: MachineStatus.Paused, label: "Paused" },
                            { value: MachineStatus.Stopped, label: "Stopped" },
                            { value: MachineStatus.Alarm, label: "Alarm" },
                          ]}
                        />
                      </Form.Item>

                      <Space orientation="vertical" size={0}>
                        <Text strong>Thanh ghi part</Text>
                        <Text type="secondary">
                          Địa chỉ: {selectedReadMachine?.partBitAddress ?? "-"}
                        </Text>
                      </Space>

                      <Form.Item name="part" style={{ marginBottom: 0 }}>
                        <InputNumber
                          disabled
                          placeholder="Giá trị Part"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>

                      <Space orientation="vertical" size={0}>
                        <Text strong>Thanh ghi Part Process</Text>
                        <Text type="secondary">
                          Địa chỉ:{" "}
                          {selectedReadMachine?.partProcessBitAddress ?? "-"}
                        </Text>
                      </Space>

                      <Form.Item name="partProcess" style={{ marginBottom: 0 }}>
                        <InputNumber
                          disabled
                          placeholder="Giá trị Part Process"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>

                      <Space orientation="vertical" size={0}>
                        <Text strong>Thanh ghi trạng thái gửi lệnh</Text>
                        <Text type="secondary">
                          Địa chỉ:{" "}
                          {selectedReadMachine?.processStatusBitAddress ?? "-"}
                        </Text>
                      </Space>

                      <Form.Item
                        name="processStatus"
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          disabled
                          placeholder="Giá trị"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                    </div>

                    <Button
                      type="default"
                      icon={<ReadOutlined />}
                      loading={submittingRead}
                      disabled={!selectedReadMachine}
                      onClick={() => void handleSubmitRead()}
                      block
                    >
                      Đọc dữ liệu
                    </Button>
                  </Form>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
