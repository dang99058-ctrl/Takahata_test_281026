"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import {
  getMachinesByPermissionAsync,
  getPartProcessByMachineAsync,
} from "@/app/services/machine/MachineService";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import {
  Machine,
  ManufacturingProcess,
  ManufacturingProcessType,
} from "@/app/types";
import { ProcessStatus } from "@/app/types/common/ProcessStatus";
import CreatePart from "@/app/workspace/admin/index/components/CreatePart";
import {
  beginSettingUpAsync,
  cancelSettingUpAsync,
  completeAsync,
  pauseAsync,
  startAsync,
} from "@/app/services/machine/ManufacturingService";

const { Text } = Typography;

import "./WorkerPage.css";
import { ApiError } from "@/app/types/common/ApiError";
import { getStatusTag } from "@/app/utilities/UtilityState";

type ProcessingFormValues = {
  startTime: number;
  machineTime: number;
  processedQuantity: number;
  note?: string;
  performedBy: string;
  workerNote?: string;
  programmingTime: number;
};

export default function WorkerPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(100);
  const [loading, setLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [machineKeyword, setMachineKeyword] = useState("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [processes, setProcesses] = useState<ManufacturingProcess[]>([]);
  const [selectedProcess, setSelectedProcess] =
    useState<ManufacturingProcess | null>(null);

  const [processingForm] = Form.useForm<ProcessingFormValues>();

  const [processingAction, setProcessingAction] = useState<
    "start" | "pause" | "complete" | null
  >(null);

  // New function
  const fetchMachines = useCallback(async () => {
    try {
      const data = await getMachinesByPermissionAsync();
      setMachines(data);
    } catch (error) {
      console.error("Lỗi khi lấy danh sách máy:", error);
      toast.error("Không thể tải danh sách máy.");
    }
  }, []);

  const fetchManufacturingProcess = useCallback(async () => {
    if (!selectedMachine) {
      setProcesses([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);

      const request = {
        page,
        pageSize,
        machineId: selectedMachine.id,
        plantDate: dayjs().format("YYYY-MM-DD"),
      };

      const result = await getPartProcessByMachineAsync(request);
      const nextProcesses = result.data ?? [];

      setProcesses(nextProcesses);
      setPage(result.page ?? page);
      setPageSize(result.pageSize ?? pageSize);
      setTotal(result.totalItems ?? nextProcesses.length);

      // Đồng bộ selectedProcess với dữ liệu mới từ server sau start/pause/complete.
      setSelectedProcess((currentProcess) => {
        if (!currentProcess) return null;

        return (
          nextProcesses.find((process) => process.id === currentProcess.id) ??
          null
        );
      });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách chi tiết cần gia công:", error);
      toast.error("Không thể tải danh sách chi tiết cần gia công.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, selectedMachine]);

  useEffect(() => {
    const run = () => {
      void fetchMachines();
    };

    void run();
  }, [fetchMachines]);

  useEffect(() => {
    const run = () => {
      void fetchManufacturingProcess();
    };
    void run();
  }, [fetchManufacturingProcess]);

  const filteredMachines = useMemo(() => {
    const normalizedKeyword = machineKeyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return machines;
    }

    return machines.filter((machine) => {
      const searchableText = `${machine.code} ${machine.name}`.toLowerCase();

      return searchableText.includes(normalizedKeyword);
    });
  }, [machineKeyword, machines]);

  const handleSelectMachine = useCallback(
    (machine: Machine) => {
      if (machine.id === selectedMachine?.id) return;

      // Khi đổi máy, không giữ process/form của máy trước đó.
      setSelectedMachine(machine);
      setSelectedProcess(null);
      setProcesses([]);
      setPage(1);
      setTotal(0);
      // processingForm.resetFields();
    },
    [selectedMachine?.id],
  );

  function handleSelectItem(record: ManufacturingProcess): void {
    setSelectedProcess(record);
  }

  const selectedProcessStatus = selectedProcess?.status;
  const isCutoverLocked = selectedProcess?.isCutoverCompleted === true;
  const isActionLoading = processingAction !== null;

  // Ma trận trạng thái:
  // Planned -> được bắt đầu.
  // Paused/PartiallyCompleted -> được tiếp tục.
  // InProgress -> được tạm dừng hoặc ghi nhận hoàn thành.
  const canStartProcessing =
    !isCutoverLocked &&
    (selectedProcessStatus === ProcessStatus.Planned ||
      selectedProcessStatus === ProcessStatus.Paused ||
      selectedProcessStatus === ProcessStatus.PartiallyCompleted);
  //   &&
  // selectedMachine != null &&
  // selectedMachine.isAutomatic;
  const canPauseProcessing =
    !isCutoverLocked && selectedProcessStatus === ProcessStatus.InProgress;
  // ||
  // (selectedMachine != null &&
  //   selectedProcess != null &&
  //   !selectedMachine.isAutomatic &&
  //   selectedProcessStatus !== ProcessStatus.Completed)
  const canCompleteProcessing =
    !isCutoverLocked && selectedProcessStatus === ProcessStatus.InProgress;
  // ||
  // (selectedMachine != null &&
  //   selectedProcess != null &&
  //   !selectedMachine.isAutomatic &&
  //   selectedProcessStatus !== ProcessStatus.Completed)
  const startButtonText = (() => {
    switch (selectedProcessStatus) {
      case ProcessStatus.Paused:
      case ProcessStatus.PartiallyCompleted:
        return "Tiếp tục gia công";
      case ProcessStatus.InProgress:
        return "Đang gia công";
      case ProcessStatus.Completed:
        return "Đã hoàn thành";
      case ProcessStatus.PendingApproval:
        return "Chờ phê duyệt";
      case ProcessStatus.Cancelled:
        return "Đã hủy";
      default:
        return "Bắt đầu gia công";
    }
  })();

  const handleBeginSettingUp = async () => {
    if (
      !selectedMachine ||
      !selectedProcess ||
      !canStartProcessing ||
      isActionLoading
    ) {
      return;
    }

    try {
      const request = {
        machineId: selectedMachine.id,
        processId: selectedProcess.id,
        partId: selectedProcess.partId,
      };

      await beginSettingUpAsync(request);
      toast.success("Bắt đầu gá đặt thành công.");
      await fetchManufacturingProcess();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        console.error("Không thể bắt đầu gá đặt:", error);
        toast.error("Không thể bắt đầu gá đặt.");
      }
    }
  };

  const handleCancelSettingUp = async () => {
    if (
      !selectedMachine ||
      !selectedProcess ||
      !canStartProcessing ||
      isActionLoading
    ) {
      return;
    }

    try {
      const request = {
        machineId: selectedMachine.id,
        processId: selectedProcess.id,
        partId: selectedProcess.partId,
      };

      await cancelSettingUpAsync(request);
      toast.success("Hủy gá đặt thành công.");
      await fetchManufacturingProcess();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        console.error("Không thể hủy gá đặt:", error);
        toast.error("Không thể hủy gá đặt.");
      }
    }
  };

  const handleStartProcessing = async () => {
    if (
      !selectedMachine ||
      !selectedProcess ||
      !canStartProcessing ||
      isActionLoading
    ) {
      return;
    }

    setProcessingAction("start");

    try {
      const request = {
        machineId: selectedMachine.id,
        processId: selectedProcess.id,
        partId: selectedProcess.partId,
      };

      await startAsync(request);
      await fetchManufacturingProcess();
      processingForm.resetFields();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        console.error("Không thể bắt đầu gia công:", error);
        toast.error("Không thể bắt đầu gia công.");
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const handlePauseProcessing = async () => {
    if (
      !selectedMachine ||
      !selectedProcess ||
      !canPauseProcessing ||
      isActionLoading
    ) {
      return;
    }

    let values: ProcessingFormValues;

    try {
      values = await processingForm.validateFields();
    } catch {
      // Form không hợp lệ: Ant Design tự hiển thị message tại field.
      return;
    }
    setProcessingAction("pause");

    try {
      const request = {
        machineId: selectedMachine.id,
        processId: selectedProcess.id,
        partId: selectedProcess.partId,
        processedQuantity: values.processedQuantity,
        performedBy: values.performedBy,
        workerNote: values.workerNote,
        programmingTime: values.programmingTime,
        machineTime: values.machineTime,
      };

      await pauseAsync(request);
      await fetchManufacturingProcess();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        console.error("Không thể tạm dừng gia công:", error);
        toast.error("Không thể tạm dừng gia công.");
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const handleCompleteProcessing = async () => {
    if (
      !selectedMachine ||
      !selectedProcess ||
      !canCompleteProcessing ||
      isActionLoading
    ) {
      return;
    }

    let values: ProcessingFormValues;

    try {
      values = await processingForm.validateFields();
    } catch {
      // Form không hợp lệ: Ant Design tự hiển thị message tại field.
      return;
    }

    setProcessingAction("complete");

    try {
      const request = {
        machineId: selectedMachine.id,
        processId: selectedProcess.id,
        partId: selectedProcess.partId,
        processedQuantity: values.processedQuantity,
        performedBy: values.performedBy,
        workerNote: values.workerNote,
        programmingTime: values.programmingTime,
        machineTime: values.machineTime,
      };

      await completeAsync(request);
      await fetchManufacturingProcess();
      processingForm.resetFields();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.getDisplayMessage());
      } else {
        toast.error("Cập nhật index thất bại");
        console.error("Không thể hoàn thành gia công:", error);
        toast.error("Không thể hoàn thành gia công.");
      }
    } finally {
      setProcessingAction(null);
    }
  };

  const processingColumns: ColumnsType<ManufacturingProcess> = [
    {
      title: "#",
      fixed: "left",
      key: "index",
      width: 48,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Mã Index",
      fixed: "left",
      dataIndex: "indexCode",
      width: 110,
    },
    {
      title: "Tên chi tiết",
      fixed: "left",
      dataIndex: "partCode",
      width: 220,
      ellipsis: true,
      render: (partCode: string, process: ManufacturingProcess) => (
        <div className="flex items-center gap-2">
          <span className="truncate">{partCode}</span>

          {process.prioritize && (
            <Tag color="orange" className="mb-0">
              Ưu tiên
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Gá đặt (giờ)",
      dataIndex: "setupTime",
      width: 120,
      align: "center",
    },
    {
      title: "Chờ (giờ)",
      dataIndex: "waitingTime",
      width: 120,
      align: "center",
    },
    {
      title: "Lập trình (giờ)",
      dataIndex: "programmingTime",
      width: 120,
      align: "center",
    },
    {
      title: "Vận hành (giờ)",
      dataIndex: "workingTime",
      width: 120,
      align: "center",
    },
    {
      title: "Số lượng",
      dataIndex: "quantity",
      width: 90,
      align: "center",
    },
    {
      title: "Đã hoàn thành",
      dataIndex: "totalProcessedQuantity",
      width: 150,
      align: "center",
    },
    {
      title: "Ghi chú",
      dataIndex: "note",
      width: 200,
      align: "center",
    },
    {
      title: "Ghi chú của người vận hành",
      dataIndex: "workerNote",
      width: 200,
      align: "center",
    },
    {
      title: "Trạng thái",
      fixed: "right",
      dataIndex: "status",
      width: 130,
      align: "center",
      render: (status: ProcessStatus, record: { isSettingUp: boolean }) => (
        <div className="d-flex flex-column align-items-center gap-1">
          {record.isSettingUp === true ? (
            <Tag color="cyan">Đang gá đặt</Tag>
          ) : (
            getStatusTag(status)
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="d-flex h-100 gap-2 overflow-hidden">
      {/* Cột chọn máy */}
      <section
        className="shrink-0 h-100 overflow-hidden"
        style={{ width: 320 }}
      >
        <Card
          className="processing-card machine-card h-100"
          styles={{
            body: {
              height: "calc(100% - 57px)",
              padding: 12,
              overflow: "hidden",
            },
          }}
          title={
            <div className="d-flex align-items-center gap-2">
              <span className="section-number">1</span>
              <span>Chọn máy</span>
            </div>
          }
        >
          <div className="d-flex flex-column h-100 overflow-hidden">
            <div className="shrink-0 mb-2">
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Tìm kiếm máy theo tên hoặc mã..."
                value={machineKeyword}
                onChange={(event) => setMachineKeyword(event.target.value)}
              />
            </div>

            <div className="grow overflow-auto pe-1">
              {filteredMachines.length > 0 ? (
                filteredMachines.map((machine) => {
                  const isSelected = selectedMachine?.id === machine.id;

                  return (
                    <button
                      type="button"
                      key={machine.id}
                      className={`btn w-100 mb-2 border rounded p-3 text-start d-flex align-items-center gap-3 ${
                        isSelected ? "btn-primary" : "btn-light"
                      }`}
                      onClick={() => handleSelectMachine(machine)}
                    >
                      <Radio checked={isSelected} />

                      <div
                        className="d-flex align-items-center justify-content-center rounded bg-body-secondary shrink-0"
                        style={{ width: 48, height: 48 }}
                      >
                        <ToolOutlined className="fs-4" />
                      </div>

                      <div className="d-flex flex-column grow overflow-hidden">
                        <strong>{machine.code}</strong>

                        <span
                          className="text-muted text-truncate"
                          title={machine.name}
                        >
                          {machine.name}
                        </span>

                        {machine.hasScheduledMaintenance && (
                          <div className="d-inline-block border border-danger rounded px-2 py-1 text-danger bg-danger-subtle fw-semibold">
                            Có lịch bảo trì
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Không tìm thấy máy"
                  className="machine-empty"
                />
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* Khu vực bên phải */}
      <section className="grow h-100 overflow-hidden">
        <div className="d-flex flex-column h-100 gap-2 overflow-hidden">
          {/* Danh sách chi tiết */}
          <Card
            className="processing-card processing-list-card grow overflow-hidden"
            styles={{
              body: {
                height: "calc(100% - 57px)",
                padding: 12,
                overflow: "hidden",
              },
            }}
            title={
              <div className="d-flex justify-content-between gap-2">
                <div className="d-flex align-items-center gap-2">
                  <span className="section-number">2</span>
                  <span>Danh sách chi tiết cần gia công</span>
                </div>

                <Button
                  onClick={() => setIsCreateOpen(true)}
                  type="primary"
                  icon={<PlusOutlined />}
                >
                  Thêm Part gia công đột xuất
                </Button>
              </div>
            }
          >
            <div className="h-100 overflow-hidden">
              <Table<ManufacturingProcess>
                rowKey="id"
                loading={loading}
                size="small"
                columns={processingColumns}
                dataSource={processes}
                scroll={{
                  x: "max-content",
                  y: "calc(100vh - 700px)",
                }}
                pagination={{
                  current: page,
                  pageSize,
                  total: total,
                  showSizeChanger: true,
                  pageSizeOptions: [5, 10, 20],
                  showTotal: (total) => `Tổng ${total} chi tiết cần gia công`,
                  onChange: (newPage, newPageSize) => {
                    const pageSizeChanged = newPageSize !== pageSize;

                    setPage(pageSizeChanged ? 1 : newPage);
                    setPageSize(newPageSize);
                  },
                }}
                rowClassName={(record) =>
                  selectedProcess?.id === record.id ? "selected-table-row" : ""
                }
                onRow={(record) => ({
                  onClick: () => handleSelectItem(record),
                })}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        selectedMachine
                          ? "Máy này chưa có chi tiết cần gia công"
                          : "Vui lòng chọn máy"
                      }
                    />
                  ),
                }}
              />
            </div>
          </Card>

          {/* Thông tin gia công - chiều cao cố định 360px */}
          {selectedProcess?.processType ==
          ManufacturingProcessType.MaintenanceProcesses ? null : (
            <Card
              className="processing-card processing-information-card shrink-0"
              style={{ height: 500 }}
              styles={{
                body: {
                  height: "calc(100% - 57px)",
                  padding: 12,
                  overflow: "hidden",
                },
              }}
              title={
                <div className="d-flex align-items-center gap-2">
                  <span className="section-number">3</span>
                  <span>Thông tin gia công</span>
                </div>
              }
            >
              <div className="d-flex flex-column h-100 overflow-hidden">
                <Row gutter={[16, 16]} className="grow overflow-hidden">
                  {/* Cột trái: Thông tin gia công */}
                  <Col xs={24} lg={8} className="h-100">
                    <div className="d-flex flex-column h-100 border rounded p-3 bg-light">
                      <div className="grow overflow-auto">
                        <div className="mb-3">
                          <Text type="secondary" className="d-block mb-1">
                            Máy
                          </Text>

                          <Text strong ellipsis={{ tooltip: true }}>
                            {selectedMachine
                              ? `${selectedMachine.code} - ${selectedMachine.name}`
                              : "Chưa chọn máy"}
                          </Text>
                        </div>

                        {isCutoverLocked && (
                          <div className="alert alert-warning py-2 px-3 mb-3">
                            Công đoạn ngày này đã được chốt sang ngày kế tiếp.
                            Chỉ xem, không thể chỉnh sửa hoặc tiếp tục gia công.
                          </div>
                        )}

                        <div className="mb-3">
                          <Text type="secondary" className="d-block mb-1">
                            Chi tiết{" "}
                            {selectedProcess?.isOverdue && (
                              <span className="text-danger">(Quá hạn)</span>
                            )}
                          </Text>

                          <Text strong ellipsis={{ tooltip: true }}>
                            {selectedProcess
                              ? `${selectedProcess.indexCode} - ${selectedProcess.partCode}`
                              : "Chưa chọn chi tiết"}
                          </Text>
                        </div>

                        <div className="mb-3">
                          <Text type="secondary" className="d-block mb-1">
                            Tiến độ gia công:{" "}
                            {selectedProcess?.totalProcessedQuantity} /{" "}
                            {selectedProcess?.quantity}
                          </Text>
                        </div>

                        {selectedProcess && (
                          <div
                            className="alert alert-warning py-2 px-3 mb-3"
                            role="alert"
                          >
                            <strong>
                              Lưu ý:{" "}
                              {selectedProcess.isOverdue
                                ? `Công việc đã được gia hạn. Tống số đã gia công ${selectedProcess.totalProcessedQuantity}.`
                                : null}{" "}
                            </strong>{" "}
                            Số lượng gia công nhập vào không được vượt quá{" "}
                            <strong>
                              {Math.max(
                                0,
                                selectedProcess.quantity -
                                  (selectedProcess.totalProcessedQuantity ?? 0),
                              )}
                            </strong>{" "}
                          </div>
                        )}
                      </div>

                      <div className="d-flex flex-row gap-2 shrink-0">
                        <Button
                          type="primary"
                          size="large"
                          block
                          className="mb-2 bg-success border-success"
                          loading={processingAction === "start"}
                          disabled={
                            !canStartProcessing ||
                            isActionLoading ||
                            isCutoverLocked ||
                            selectedProcess?.isSettingUp
                          }
                          onClick={handleBeginSettingUp}
                        >
                          Bắt đầu gá đặt
                        </Button>
                        <Button
                          size="large"
                          className="mb-2"
                          disabled={
                            isActionLoading ||
                            isCutoverLocked ||
                            !selectedProcess?.isSettingUp
                          }
                          onClick={handleCancelSettingUp}
                        >
                          Bỏ
                        </Button>
                      </div>

                      <Button
                        type="primary"
                        size="large"
                        block
                        icon={<PlayCircleOutlined />}
                        loading={processingAction === "start"}
                        disabled={
                          !canStartProcessing || isActionLoading || isCutoverLocked
                        }
                        onClick={handleStartProcessing}
                      >
                        {startButtonText}
                      </Button>
                    </div>
                  </Col>

                  {/* Cột phải: Form nhập thông tin */}
                  <Col xs={24} lg={16} className="h-100">
                    <div className="d-flex flex-column h-100 border rounded p-3 overflow-hidden">
                      <div className="grow overflow-y-auto overflow-x-hidden px-1">
                        <Form<ProcessingFormValues>
                          form={processingForm}
                          layout="vertical"
                          disabled={isCutoverLocked}
                          initialValues={{
                            startTime: 0,
                            machineTime: 0,
                            processedQuantity: 0,
                            programmingTime: 0,
                            note: "",
                          }}
                        >
                          <Row gutter={[12, 0]}>
                            <Col xs={24} sm={8}>
                              <Form.Item
                                label="Người thực hiện"
                                name="performedBy"
                                rules={[
                                  {
                                    required: true,
                                    message: "Vui lòng nhập người thực hiện.",
                                  },
                                  {
                                    whitespace: true,
                                    message:
                                      "Người thực hiện không được chỉ chứa khoảng trắng.",
                                  },
                                  {
                                    max: 100,
                                    message:
                                      "Người thực hiện không được vượt quá 100 ký tự.",
                                  },
                                ]}
                              >
                                <Input
                                  className="w-100"
                                  placeholder="Nhập tên người thực hiện"
                                  maxLength={100}
                                />
                              </Form.Item>
                            </Col>

                            <Col xs={24} sm={8}>
                              <Form.Item
                                label="Số lượng đã gia công"
                                name="processedQuantity"
                                rules={[
                                  {
                                    required: true,
                                    message: "Nhập số lượng đã gia công",
                                  },
                                  {
                                    validator: (_, value) => {
                                      if (
                                        value === undefined ||
                                        value === null ||
                                        !selectedProcess ||
                                        value <= selectedProcess.quantity
                                      ) {
                                        return Promise.resolve();
                                      }

                                      return Promise.reject(
                                        new Error(
                                          `Số lượng đã gia công không được vượt quá ${selectedProcess.quantity}`,
                                        ),
                                      );
                                    },
                                  },
                                ]}
                              >
                                <InputNumber
                                  min={0}
                                  max={selectedProcess?.quantity}
                                  className="w-100"
                                />
                              </Form.Item>
                            </Col>

                            {selectedMachine != null &&
                            !selectedMachine.isAutomatic ? (
                              <Col xs={24} sm={8}>
                                <Form.Item
                                  label="Thời gian vận hành (giờ)"
                                  name="machineTime"
                                >
                                  <InputNumber min={0} className="w-100" />
                                </Form.Item>
                              </Col>
                            ) : (
                              <Col xs={24} sm={8}>
                                <Form.Item
                                  label="Thời gian lập trình (giờ)"
                                  name="programmingTime"
                                >
                                  <InputNumber
                                    disabled={
                                      selectedMachine != null &&
                                      !selectedMachine.isAutomatic
                                    }
                                    min={0}
                                    className="w-100"
                                  />
                                </Form.Item>
                              </Col>
                            )}
                          </Row>

                          <Row gutter={[12, 0]}>
                            <Col xs={24} sm={24}>
                              <Form.Item
                                label="Ghi chú của người vận hành"
                                name="workerNote"
                              >
                                <Input.TextArea
                                  rows={4}
                                  placeholder="Nhập ghi chú"
                                />
                              </Form.Item>
                            </Col>
                          </Row>
                        </Form>
                      </div>

                      <div className="d-flex justify-content-end align-items-center gap-2 pt-3 mt-2 border-top shrink-0">
                        <Button
                          icon={<PauseOutlined />}
                          loading={processingAction === "pause"}
                          disabled={
                            !canPauseProcessing || isActionLoading || isCutoverLocked
                          }
                          onClick={handlePauseProcessing}
                        >
                          Tạm dừng
                        </Button>

                        <Button
                          type="primary"
                          className="complete-button"
                          icon={<CheckCircleOutlined />}
                          loading={processingAction === "complete"}
                          disabled={
                            !canCompleteProcessing ||
                            isActionLoading ||
                            isCutoverLocked
                          }
                          onClick={handleCompleteProcessing}
                        >
                          Hoàn thành
                        </Button>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            </Card>
          )}
        </div>
      </section>

      <CreatePart
        open={isCreateOpen}
        status={ProcessStatus.PendingApproval}
        onClose={() => {
          setIsCreateOpen(false);
          void fetchManufacturingProcess();
        }}
      />
    </div>
  );
}
